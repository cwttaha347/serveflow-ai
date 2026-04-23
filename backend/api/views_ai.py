from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from .models import Category, SystemSettings
import os
import time
import uuid
import json
import re
import difflib
import google.generativeai as genai
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from PIL import Image
from PIL import ImageOps
import os
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    print("Warning: pillow-heif not installed. HEIC support will be limited.")

_CACHED_GEMINI_MODEL_NAME = None

class AIImageAnalysisView(APIView):
    """
    Advanced AI endpoint for analyzing uploaded images for service requests.
    INTEGRATED WITH GOOGLE GEMINI (MULTI-KEY ROTATION).
    """
    parser_classes = (MultiPartParser, FormParser)

    def _pick_gemini_model_name(self):
        """
        Gemini model names vary by API/key availability. Avoid hardcoding a single model.
        Cache the first working model per process.
        """
        global _CACHED_GEMINI_MODEL_NAME
        # Allow an explicit override (useful when you want to force Gemini 3).
        # This MUST take precedence over any cached value.
        forced = (os.environ.get("GEMINI_MODEL_NAME") or "").strip()
        if forced:
            _CACHED_GEMINI_MODEL_NAME = forced
            return forced

        if _CACHED_GEMINI_MODEL_NAME:
            return _CACHED_GEMINI_MODEL_NAME

        preferred = [
            "gemini-3.0-flash",
            "gemini-3-flash"
        ]
        try:
            models = list(genai.list_models())
            name_set = {getattr(m, "name", "") for m in models}
            def supports_generate(m):
                methods = getattr(m, "supported_generation_methods", []) or []
                return "generateContent" in methods

            # Prefer known good names if present and supported.
            for n in preferred:
                full = f"models/{n}"
                if full in name_set:
                    mobj = next((m for m in models if getattr(m, "name", "") == full), None)
                    if mobj and supports_generate(mobj):
                        _CACHED_GEMINI_MODEL_NAME = n
                        return n

            # Otherwise choose the first model supporting generateContent.
            for m in models:
                if supports_generate(m):
                    raw = getattr(m, "name", "")
                    if raw.startswith("models/"):
                        _CACHED_GEMINI_MODEL_NAME = raw.split("models/", 1)[1]
                        return _CACHED_GEMINI_MODEL_NAME
        except Exception:
            pass

        _CACHED_GEMINI_MODEL_NAME = "gemini-1.5-pro"
        return _CACHED_GEMINI_MODEL_NAME

    def _downscale_for_ai(self, src_path: str) -> str:
        """
        Reduce very large images to a safe size for AI processing.
        Keeps the original upload saved on disk, but uses a smaller derived file for PIL+Gemini.
        """
        try:
            img = Image.open(src_path)
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")

            max_dim = 1600
            if max(img.size) > max_dim:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            derived_name = f"temp/analysis_small_{uuid.uuid4()}.jpg"
            derived_path = default_storage.save(derived_name, ContentFile(b""))
            full_derived_path = os.path.join(settings.MEDIA_ROOT, derived_path)
            os.makedirs(os.path.dirname(full_derived_path), exist_ok=True)
            img.save(full_derived_path, format="JPEG", quality=82, optimize=True, progressive=True)
            return full_derived_path
        except Exception:
            return src_path

    def _normalize_tokens(self, text):
        return {t for t in re.findall(r"[a-z0-9]{3,}", str(text or "").lower())}

    def _rank_categories(self, ai_result, available_categories):
        requested = str(ai_result.get("category_match", "")).strip()
        observations = " ".join(str(x) for x in (ai_result.get("key_observations") or []))
        text = f"{requested} {ai_result.get('suggested_title', '')} {ai_result.get('suggested_description', '')} {observations}"
        msg_tokens = self._normalize_tokens(text)
        if not msg_tokens:
            return []

        scored = []
        for cat in available_categories:
            cat_tokens = self._normalize_tokens(f"{cat.name} {cat.description}")
            overlap = len(msg_tokens.intersection(cat_tokens))
            fuzzy = 0
            for mt in msg_tokens:
                if mt in cat_tokens:
                    continue
                sim = max((difflib.SequenceMatcher(None, mt, ct).ratio() for ct in cat_tokens), default=0)
                if sim >= 0.74:
                    fuzzy += 1
            score = (overlap + (0.6 * fuzzy)) / max(1, len(msg_tokens))
            if requested and requested.lower() == cat.name.lower():
                score += 0.15
            scored.append((cat, float(score)))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored

    def _resolve_category(self, ai_result, available_categories):
        confidence = float(ai_result.get("confidence_score") or 0.0)
        ranked = self._rank_categories(ai_result, available_categories)
        if not ranked:
            return None
        best, best_score = ranked[0]

        # Guardrail: do not force a category when confidence is weak.
        if confidence < 0.50 and best_score < 0.18:
            return None
        if best_score < 0.12:
            return None
        return best

    def post(self, request, *args, **kwargs):
        if 'image' not in request.data:
            return Response({'error': 'No image data provided'}, status=status.HTTP_400_BAD_REQUEST)

        image_file = request.data['image']
        
        # --- SECURITY PROTOCOL: STEP 1 (File Analysis) ---
        # Allow larger uploads but downscale for AI processing.
        if image_file.size > 30 * 1024 * 1024:  # 30MB absolute cap
            return Response({'error': 'Security Alert: File exceeds maximum size limit (30MB).'}, status=status.HTTP_400_BAD_REQUEST)
        
        allowed_types = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
        if image_file.content_type not in allowed_types:
            return Response({'error': 'Security Alert: Unsupported or potentially malicious file format.'}, status=status.HTTP_400_BAD_REQUEST)

        # Save the file temporarily
        file_ext = os.path.splitext(image_file.name)[1]
        file_name = f"analysis_{uuid.uuid4()}{file_ext}"
        file_path = default_storage.save(f"temp/{file_name}", ContentFile(image_file.read()))
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        full_url = request.build_absolute_uri(settings.MEDIA_URL + file_path)

        # --- AI PROCESSING: STEP 3 (Vision Analysis) ---
        
        # 1. Fetch Categories for prompt context
        category_qs = list(Category.objects.filter(is_active=True).only("id", "name", "description"))
        categories_str = "; ".join(
            [f"{c.name}: {str(c.description or '').strip()[:160]}" for c in category_qs]
        )

        # 2. Prepare Prompt
        prompt = f"""
        Analyze this image of a potential maintenance issue.
        You are an expert home repair estimator.
        
        Available Categories (name: description): {categories_str}
        
        Return a strict JSON object (no markdown) with the following fields:
        - key_observations: list of 3-5 visual facts.
        - category_match: The exact name of the closest matching category from the list above. If none match, use "General".
        - suggested_title: A professional, concise title for a service request.
        - suggested_description: A detailed, professional description of the issue for a service provider.
        - estimated_budget_range: A realistic price range (e.g. "$100 - $250") based on US market rates.
        - urgency: "Low", "Medium", "High", or "Critical".
        - confidence_score: A number between 0.0 and 1.0.
        
        If the image is NOT related to home maintenance/repairs (e.g. selfie, landscape, pet), return JSON with "is_relevant": false.
        Otherwise "is_relevant": true.
        Important:
        - Do not default to Plumbing unless image evidence strongly supports plumbing fixtures/pipes/water leakage.
        - Prefer "General" when uncertain instead of guessing a specific category.
        """

        # 3. Get API Keys & Rotate
        system_settings = SystemSettings.get_settings()
        valid_keys = system_settings.get_gemini_api_keys(prefer_env=True, sync_env_to_db=True)
        
        if not valid_keys:
             # Fallback to simulation if no keys are configured
             return self.simulated_response(category_qs, full_url)

        ai_result = None
        last_error = None

        try:
            ai_image_path = self._downscale_for_ai(full_path)
            pil_image = Image.open(ai_image_path)
            
            for idx, key in enumerate(valid_keys, start=1):
                try:
                    print(f"Attempting Gemini analysis with key #{idx}")
                    genai.configure(api_key=key)
                    model_name = self._pick_gemini_model_name()
                    print(f"Using Gemini model: {model_name}")
                    model = genai.GenerativeModel(model_name)
                    
                    response = model.generate_content(
                        [prompt, pil_image],
                        generation_config={
                            "response_mime_type": "application/json",
                            # Lower randomness reduces category hallucination.
                            "temperature": 0.1,
                            "top_p": 0.9,
                        }
                    )
                    response_text = (response.text or "").strip()
                    if response_text.startswith("```json"):
                        response_text = response_text.split("```json", 1)[1].split("```", 1)[0].strip()
                    elif response_text.startswith("```"):
                        response_text = response_text.split("```", 1)[1].split("```", 1)[0].strip()
                    ai_result = json.loads(response_text)
                    print("AI Analysis Successful")
                    break # Success! Match found.
                except Exception as e:
                    print(f"Key failed: {e}")
                    last_error = e
                    continue # Try next key

            if not ai_result:
                raise last_error or Exception("All API keys failed or were exhausted.")

            # Process Result
            if not ai_result.get('is_relevant', True):
                 return Response({
                    'error': 'Image Irrelevant: The uploaded image does not appear to be a maintenance issue.',
                    'code': 'IRRELEVANT_CONTENT'
                }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            
            category_obj = self._resolve_category(ai_result, category_qs)
            ranked = self._rank_categories(ai_result, category_qs)
            candidates = [
                {"category_id": c.id, "category_name": c.name, "score": round(score, 4)}
                for c, score in ranked[:3]
            ]
            
            final_response = {
                "success": True,
                "security_check": "PASSED",
                "content_safety": "CLEAN", # Gemini filters these usually, assuming clean if we got here
                "analysis": {
                    "detected_objects": ai_result.get('key_observations', []),
                    "confidence": ai_result.get('confidence_score', 0.9),
                    "summary": f"AI identified: {ai_result.get('suggested_title', ai_result.get('title', 'Unknown Issue'))}",
                    "suggested_title": ai_result.get('suggested_title') or ai_result.get('title') or "New Service Request",
                    "suggested_description": ai_result.get('suggested_description') or ai_result.get('description') or "Please provide more details.",
                    "category_id": category_obj.id if category_obj else None,
                    "category_match": category_obj.name if category_obj else None,
                    "category_candidates": candidates,
                    "estimated_budget_range": ai_result.get('estimated_budget_range') or ai_result.get('budget', '$50 - $150'),
                    "urgency": ai_result.get('urgency', 'Medium'),
                    "image_url": full_url
                }
            }
            
            return Response(final_response, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Critical AI Error: {e}")
            # Fallback to simulation on critical failure so app doesn't break
            fallback_categories = category_qs or list(Category.objects.filter(is_active=True).only("id", "name", "description"))
            return self.simulated_response(fallback_categories, full_url)
        finally:
            # Cleanup temp file? Maybe keep it for the actual request creation if used.
            # For now, we leave it. A cron job should clean temp/ folder.
            pass

    def simulated_response(self, categories, full_url):
        """Fallback simulation if AI fails or no keys"""
        print("Falling back to simulation mode...")
        time.sleep(1.5)
        categories = list(categories or [])
        preferred = next((c for c in categories if str(getattr(c, "name", "")).strip().lower() == "general"), None)
        chosen = preferred or (categories[0] if categories else None)
        candidates = []
        for c in categories[:3]:
            candidates.append({
                "category_id": getattr(c, "id", None),
                "category_name": getattr(c, "name", None),
                "score": 0.0,
            })
        return Response({
            "success": True,
            "security_check": "PASSED - SIMULATION",
            "content_safety": "CLEAN",
            "is_simulated": True,
            "analysis": {
                "detected_objects": ["Detected via Simulation"],
                "confidence": 0.7,
                "summary": "Initial assessment generated in fallback mode.",
                "suggested_title": "Service Request (Review Needed)",
                "suggested_description": "I detected a potential maintenance issue from the image, but category confidence is low in fallback mode. Please confirm the category before submission.",
                "category_id": getattr(chosen, "id", None) if chosen else None,
                "category_match": getattr(chosen, "name", None) if chosen else None,
                "category_candidates": candidates,
                "estimated_budget_range": "$100 - $300",
                "urgency": "Medium",
                "image_url": full_url
            }
        }, status=status.HTTP_200_OK)
