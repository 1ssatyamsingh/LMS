# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Monorepo with two Node.js projects:
  - client: React 19 + Vite 7 SPA with Tailwind CSS 4 and Clerk for auth
  - server: Express 5 API with MongoDB (Mongoose), Clerk auth middleware, Stripe checkout/webhooks, and Cloudinary uploads

Commands

Prerequisites
- Use npm (package-lock.json present in both workspaces)
- Run commands from the indicated subdirectory

Install dependencies
- Client
```bash path=null start=null
npm ci --prefix client
```
- Server
```bash path=null start=null
npm ci --prefix server
```

Run in development
- Client (Vite dev server)
```bash path=null start=null
npm run dev --prefix client
```
- Server (Nodemon)
```bash path=null start=null
npm run server --prefix server
```
Tip: Start each in separate terminals. The API listens on PORT (default 5000). The client dev server will proxy only if configured; otherwise, use full API URLs from the client.

Build/preview
- Client build
```bash path=null start=null
npm run build --prefix client
```
- Client preview (serves the production build)
```bash path=null start=null
npm run preview --prefix client
```
- Server has no build step; start with Node
```bash path=null start=null
npm start --prefix server
```

Linting
- Client (ESLint 9 flat config)
```bash path=null start=null
npm run lint --prefix client
```
- Server: no lint script/config present

Testing
- No test runner is configured in client or server. There is no single-test command available.

Environment configuration

Client (Vite)
- VITE_CLERK_PUBLISHABLE_KEY: Clerk publishable key used by ClerkProvider in src/main.jsx
- VITE_CURRENCY: Display currency code used by context logic

Server (Express API)
- PORT: Optional; defaults to 5000
- MONGODB_URI: Base Mongo connection string (database name is appended as /lms)
- CLOUDINARY_NAME, CLOUDINARY_API_KEY, CLOUDINARY_SECRET_KEY: Cloudinary configuration
- CLERK_WEBHOOK_SECRET: Svix secret to verify Clerk webhooks
- STRIPE_SECRET_KEY: Stripe secret used for Checkout/session management
- STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret
- CURRENCY: Currency code used for pricing/checkout

High-level architecture and flow

Frontend (client)
- Entry: src/main.jsx mounts App inside BrowserRouter, wraps with ClerkProvider and AppContextProvider
- Routing: src/App.jsx defines student-facing routes (/ , /course-list, /course/:id, /my-enrollments, /player/:courseId) and nested educator routes under /educator (dashboard, add-course, my-courses, student-enrolled). The student Navbar is hidden on educator routes.
- State/context: src/context/AppContext.jsx centralizes UI-facing course data and helpers (rating calculation, duration and lecture counts). Currently sources data from dummyCourses; API integration hooks exist conceptually but not wired up.
- UI: Tailwind CSS 4 configured via tailwind.config.js; components organized under components/students and components/educator; Quill editor styles imported where needed.
- Auth: Clerk client SDK (ClerkProvider, useAuth, useUser). Tokens can be retrieved via getToken() in context when user is present.

Backend (server)
- Entry: server/server.js
  - Initializes Express, applies CORS and Clerk middleware, connects to MongoDB and Cloudinary
  - Routes
    - GET / -> health check
    - POST /clerk -> Clerk webhook (JSON, verified via Svix using CLERK_WEBHOOK_SECRET)
    - POST /stripe -> Stripe webhook (expects raw body: express.raw({ type: 'application/json' }))
    - /api/course -> public course endpoints
    - /api/user -> user-specific endpoints (requires Clerk auth context)
    - /api/educator -> educator endpoints (protected by role middleware)
- Auth and roles
  - Clerk middleware attaches req.auth; protectEducator checks Clerk publicMetadata.role === 'educator'
  - updateRoleToEducator endpoint updates Clerk publicMetadata via Clerk server SDK
- Persistence (Mongoose models)
  - User: String _id (from Clerk), name, email, imageUrl, enrolledCourses [ObjectId -> Course]
  - Course: title, description, thumbnail, price, discount, isPublished, content (chapters -> lectures), ratings [{ userId, rating }], educator (String ref), enrolledStudents [String ref]
  - Purchase: courseId -> Course, userId (String -> User), amount, status (pending/completed/failed)
- Payments
  - purchaseCourse creates a Purchase, initializes Stripe Checkout (line_items, currency from CURRENCY), and returns session_url
  - stripeWebhooks listens for payment_intent.succeeded/payment_failed, reconciles Purchase and enrolls user in course by updating both User.enrolledCourses and Course.enrolledStudents
- File uploads
  - Multer disk storage receives thumbnail as image (field: image) on add-course; uploaded to Cloudinary, URL saved on Course

API surface (concise)
- /api/course
  - GET /all: list published courses (excludes content/enrolledStudents; populates educator)
  - GET /:id: fetch course; lectureUrl cleared unless isPreviewFree
- /api/user
  - GET /data: current user document by req.auth.userId
  - GET /enrolled-courses: current user’s enrolledCourses (populated)
  - POST /purchase: { courseId } -> Stripe Checkout session_url
- /api/educator
  - GET /update-role: elevates current user to educator role in Clerk
  - POST /add-course: multipart/form-data with image; requires educator role
  - GET /courses: list courses by current educator
  - GET /dashboard: totals (earnings from completed purchases, total courses, enrolled students summary)
  - GET /enrolled-students: completed purchases populated with user and course title
- Webhooks
  - POST /clerk: handles user.created | user.updated | user.deleted
  - POST /stripe: handles payment_intent.succeeded | payment_intent.payment_failed

Operational notes
- The Stripe webhook route uses express.raw; ensure any proxy preserves the raw body for signature verification.
- Database name is fixed to lms by the connection helper (MONGODB_URI is a base, e.g., mongodb+srv://... without a trailing DB name or it will append /lms).
- Client/Server run independently; there is no orchestrator or proxy configured in this repo.
