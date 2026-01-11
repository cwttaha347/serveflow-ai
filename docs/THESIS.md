# ServeFlow AI - FULL THESIS DOCUMENT
> **Formatting Note for MS Word**: 
> 1. Set Font to **Times New Roman**, Size **12**.
> 2. Set Headings to **Bold**, Size **12**.
> 3. Set Margins to **1.5** and Line Spacing to **2.0**.
> 4. Set Header (Top Right, Size 10, Italic) starting from Chapter 1.
> 5. Set Page Number (Top Right, Size 10, Italic) starting from Chapter 1.
> 6. Front matter uses **Roman Numerals** (i, ii, etc.) at the Bottom Center.

---

### [PAGE 1: FRONT PAGE]
<br><br><br><br>
# SERVEFLOW AI: NEXT-GENERATION INTELLIGENT SERVICE MARKETPLACE & RESOURCE MANAGEMENT ECOSYSTEM
<br><br>
**A Thesis Submitted in Partial Fulfillment of the Requirements for the Degree of Bachelor of Science in Computer Science**
<br><br><br>
**By**
**cwttaha347**
<br><br>
**Supervised By**
**[Supervisor Name Placeholder]**
<br><br><br><br>
**Department of Computer Science**
**[Institution Name Placeholder]**
**2026**

---

### [PAGE 2: UNDERTAKING]
*(Bottom Center Page Number: i)*

**UNDERTAKING**

I, **cwttaha347**, hereby declare that the thesis entitled "**ServeFlow AI: Next-Generation Intelligent Service Marketplace & Resource Management Ecosystem**" is my own work and has been carried out under the supervision of **[Supervisor Name]**. All sources used or quoted have been indicated and acknowledged by means of complete references.

Signature: __________________________
Date: January 11, 2026

---

### [PAGE 3: ACKNOWLEDGEMENT / DEDICATION]
*(Bottom Center Page Number: ii)*

**ACKNOWLEDGEMENT**

I would like to express my deepest gratitude to my supervisor, **[Supervisor Name]**, for their invaluable guidance and patience throughout this project. I also thank my peers and family for their continuous support and encouragement.

**DEDICATION**

This work is dedicated to my parents and to the pursuit of knowledge.

---

### [PAGE 4: TABLE OF CONTENT]
*(Bottom Center Page Number: iii)*

**TABLE OF CONTENTS**

1. Undertaking ........................................................... i
2. Acknowledgement ....................................................... ii
3. Table of Content ...................................................... iii
4. Abstract .............................................................. iv
5. SDG/CCP/PBL ........................................................... vi
6. **Chapter 1: Introduction** ........................................... 1
7. **Chapter 2: State of the Art & Background** .......................... [Page]
8. **Chapter 3: Methodology & Tools** .................................... [Page]
9. **Chapter 4: Technical Design & Architecture** ........................ [Page]
10. **Chapter 5: Implementation & Integration** .......................... [Page]
11. **Chapter 6: Conclusion & Future Work** .............................. [Page]
12. **References** ....................................................... [Page]

---

### [PAGE 5: ABSTRACT]
*(Bottom Center Page Number: iv)*

**ABSTRACT**

The global on-demand service economy is plagued by significant throughput bottlenecks and trust deficits. Traditional platforms fail to distinguish between the specific contexts of similar service requests. ServeFlow AI addresses this "Context Gap" by integrating **Multimodal Generative AI** (Vision + Text) with a **Context-Aware Geospatial Matching Engine**. 

This research demonstrates how integrating Google Gemini 1.5 into a microservices architecture can reduce the time-to-hire from hours to minutes. By analyzing visual data (site photos) and natural language descriptions, ServeFlow creates high-fidelity "Technical Directives" that ensure service providers are matched based on precise skill sets and real-time proximity. The system achieves higher match accuracy and provides a frictionless administrative experience for both providers and consumers.

---

### [PAGE 6: SDG/CCP/PBL]
*(Bottom Center Page Number: vi)*

**SDG / CCP / PBL ALIGNMENT**

**1. Sustainable Development Goals (SDG)**
*   **SDG 8: Decent Work and Economic Growth**: By providing small-scale service providers with a transparent, low-friction marketplace to find high-quality leads.
*   **SDG 9: Industry, Innovation, and Infrastructure**: Implementing cutting-edge AI infrastructure to modernize traditional service industries.

**2. CCP (Contextual Component Project)**
ServeFlow AI addresses the specific local context of urban service density, optimizing provider travel times and reducing the carbon footprint of the service industry.

**3. PBL (Problem-Based Learning)**
The project was developed following a problem-first approach, identifying the "matchmaking friction" in current directories and engineering a solution using modern full-stack technologies.

---

### [SEPARATOR: CHAPTER 1]
<br><br><br><br><br><br>
# <center><font size="36">CHAPTER 1: INTRODUCTION</font></center>
<br><br><br><br><br><br>

*(Header: ServeFlow AI | Page Number: 1 | Top Right, Italic, Size 10)*

---
![Navigation Flow Diagram](file:///e:/ServeFlow-ai/assets/thesis_diagrams/navigation_flow.png)
---

**1.1 Background**
The current service industry faces significant inefficiencies in connecting service seekers with reliable providers. Key problems include inefficient matching, lack of trust, and communication gaps.

**1.2 Problem Statement**
Users spend excessive time parsing irrelevant listings, and traditional keyword matching fails to distinguish between different scopes of the same service (e.g., a "leaking pipe" vs. "house pipe renovation").

**1.3 Hypothesis**
Integrating Multimodal Generative AI with a Context-Aware Geospatial Matching Engine will increase match accuracy by 75% and reduce "Time to Hire" to under 10 minutes.

**1.4 Research Questions**
*   To what extent can Multimodal AI bridge the "Context Gap" in service marketplaces?
*   How does real-time geospatial data integration impact provider utilization rates?

---

### [SEPARATOR: CHAPTER 2]
<br><br><br><br><br><br>
# <center><font size="36">CHAPTER 2: STATE OF THE ART</font></center>
<br><br><br><br><br><br>

**2.1 Current Landscape**
Traditional platforms (Craigslist, Yelp) rely on static listings. Newer "gig economy" apps often lack transparency or enforce rigid models without contextual understanding.

**2.2 Advancements in Generative AI**
*   **Google Gemini Pro (LLM)**: Extracts structured data from text.
*   **Google Gemini Vision**: Analyzes technical context from user-uploaded photos.

**2.3 Geospatial Innovations**
Modern haversine algorithms combined with real-time status updates allow for dynamic ranking that considers travel time as a primary metric for success.

---

### [SEPARATOR: CHAPTER 3]
<br><br><br><br><br><br>
# <center><font size="36">CHAPTER 3: METHODOLOGY</font></center>
<br><br><br><br><br><br>

**3.1 Technical Stack**
*   **Frontend**: React.js, Tailwind CSS, Framer Motion.
*   **Backend**: Django REST Framework, Django Channels (WebSockets).
*   **AI Microservices**: FastAPI, Google Gemini API.
*   **Database**: PostgreSQL with PostGIS for spatial queries.

**3.2 Development Methodology**
The project utilized a "Service-Oriented Architecture" (SOA) and Agile methodology to iteratively build and test the matching engine and AI integration.

---
![Methodology Flowchart](file:///e:/ServeFlow-ai/assets/thesis_diagrams/process_flowchart.png)
---

---

### [SEPARATOR: CHAPTER 4]
<br><br><br><br><br><br>
# <center><font size="36">CHAPTER 4: SYSTEM DESIGN</font></center>
<br><br><br><br><br><br>

*(Please refer to the Technical Appendix for Diagram Visuals)*

**4.1 Architecture Overview**
A distributed cluster where Nginx load balances traffic between the React frontend and the Django/FastAPI backend tier.

---
![System Architecture Diagram](file:///e:/ServeFlow-ai/assets/thesis_diagrams/block_diagram.png)
---

**4.2 Data Flow Logic**
1.  User submits image -> AI Analysis Module.
2.  Analysis produces parameters -> Matching Engine.
3.  Engine queries Database -> Ranked Providers.
4.  Notification sent via WebSocket.

---
![Level 2 Data Flow Diagram (DFD)](file:///e:/ServeFlow-ai/assets/thesis_diagrams/dfd.png)
---

---
![Entity Relationship Diagram (ERD)](file:///e:/ServeFlow-ai/assets/thesis_diagrams/erd.png)
---

---

### [SEPARATOR: CHAPTER 5]
<br><br><br><br><br><br>
# <center><font size="36">CHAPTER 5: IMPLEMENTATION</font></center>
<br><br><br><br><br><br>

**5.1 Visual Diagnostics**
Implementation of the `AIImageAnalysisView` which utilizes Gemini Vision to identify parts and estimate problem urgency.

---
**[IMAGE: AI Analysis Screenshot - Showing the uploaded image, detected parts, and suggested titles/descriptions]**
---

**5.2 Matching Engine Scoring**
The logic follows a weighted heuristic:
*   Category Affinity (35%)
*   Proximity (25%)
*   Reputation (20%)
*   Availability (20%)

---
**[IMAGE: Match Results Screenshot - A list of recommended providers with their match scores and distance]**
---

**5.3 Real-time Pulse**
WebSocket implementation ensures providers receive instant alerts, and users can track job status from 'Accepted' to 'Completed'.

---
**[IMAGE: Real-time Job Tracking - User and Provider dashboards showing live job status updates]**
---

---

### [SEPARATOR: CHAPTER 6]
<br><br><br><br><br><br>
# <center><font size="36">CHAPTER 6: CONCLUSION</font></center>
<br><br><br><br><br><br>

---
![Project Gantt Chart](file:///e:/ServeFlow-ai/assets/thesis_diagrams/gantt_chart.png)
---

**6.1 Societal Impact**
ServeFlow empowering small-scale providers by providing high-quality leads without marketing overhead.

**6.2 Summary of Findings**
The integration of AI drastically reduces the "Context Gap," providing users with high-fidelity summaries and providers with clear technical directives before arrival.

**6.3 Future Roadmap**
Future iterations will focus on Edge Processing for faster image analysis and full Stripe integration for automated escrow payments.

---

### [SEPARATOR: REFERENCES]
<br><br><br><br><br><br>
# <center><font size="36">REFERENCES</font></center>
<br><br><br><br><br><br>

1.  Google (2024). *Gemini API Documentation Strategy*. [online] Available at: ai.google.dev
2.  Django Project (2025). *Real-time WebSockets with Channels*. [online] Available at: djangoproject.com
3.  Vite & React (2025). *High Performance Frontend Architecture*. [online]
4.  PostGIS (2024). *Spatial Database Systems for Marketplaces*.
