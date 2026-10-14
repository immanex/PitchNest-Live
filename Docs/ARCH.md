# PitchNest-Live: Folder Structure

```
PitchNest-Live/
│
├── backend/                                   # Node.js + TypeScript API
│   ├── Docs/
│   │   └── AI_FEATURES.md
│   │
│   ├── migrations/                            # Database schema changes (run in order)
│   │   ├── 0001_add_role_to_users.sql
│   │   ├── 0002_add_bio_to_users.sql
│   │   ├── 0003_add_settings_and_avatar_to_users.sql
│   │   ├── 0004_enable_rls.sql
│   │   ├── 0005_add_login_lockout.sql
│   │   ├── 0006_private_media_bucket.sql
│   │   ├── 0008_add_plans_and_usage_ledger.sql
│   │   ├── 0009_flutterwave_billing.sql
│   │   ├── 0010_paid_tiers_and_terms.sql
│   │   ├── 0011_free_trial_and_plans.sql
│   │   ├── 0012_verification_hardening.sql
│   │   ├── 0013_pitch_attempts.sql
│   │   ├── 0014_deck_page_count.sql
│   │   ├── 0015_session_sharing.sql            # Public share_id links (noindex, highlights only)
│   │   ├── 0016_trial_email_log.sql            # Trial-ending email dedupe (server-only, RLS denies anon)
│   │   └── 0017_founder_profiles.sql           # Cross-session founder memory (server-only, RLS denies anon)
│   │
│   │   # NOTE: these are applied MANUALLY — there is no migration runner.
│   │   # A migration that has not been run in an environment fails soft:
│   │   # the feature stays dormant and the server logs a warning.
│   │
│   ├── scripts/
│   │   ├── check-overlaps.ts
│   │   ├── render-pdf.mjs
│   │   └── test-report.ts
│   │
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── supabase.ts
│   │   │
│   │   ├── controllers/
│   │   │   ├── adminController.ts
│   │   │   ├── authController.ts
│   │   │   ├── billingController.ts
│   │   │   ├── deckController.ts
│   │   │   ├── fileController.ts
│   │   │   ├── profileController.ts
│   │   │   ├── sessionController.ts
│   │   │   ├── uploadController.ts
│   │   │   └── waitlistController.ts
│   │   │
│   │   ├── middleware/
│   │   │   ├── adminMiddleware.ts
│   │   │   └── authMiddleware.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── adminRoutes.ts
│   │   │   ├── authRoutes.ts
│   │   │   ├── billingRoutes.ts
│   │   │   ├── deckRoutes.ts
│   │   │   ├── fileRoutes.ts
│   │   │   ├── profileRoutes.ts
│   │   │   ├── sessionRoutes.ts
│   │   │   └── uploadRoutes.ts
│   │   │
│   │   ├── services/
│   │   │   ├── aiService.ts
│   │   │   ├── deckIntelligenceService.ts
│   │   │   ├── deckTextService.ts
│   │   │   ├── entitlementService.ts
│   │   │   ├── flutterwaveService.ts
│   │   │   ├── founderMemoryService.ts     # Cross-session founder memory (pure; no I/O)
│   │   │   ├── pdfService.ts
│   │   │   ├── pitchAttemptService.ts
│   │   │   ├── pitchMemoryService.ts
│   │   │   ├── researchService.ts
│   │   │   ├── storageService.ts
│   │   │   ├── sttService.ts              # Speech-to-text
│   │   │   └── ttsService.ts              # Text-to-speech
│   │   │
│   │   ├── sockets/
│   │   │   └── restSocket.ts
│   │   │
│   │   ├── tests/
│   │   │   ├── deck_type_test.ts
│   │   │   └── run_tests.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── aiTextSanitizer.ts
│   │   │   ├── conversationWindow.ts
│   │   │   ├── deliveryMetrics.ts           # Filler rate / talk ratio / pace (PDF + founder memory)
│   │   │   ├── floorControl.ts
│   │   │   ├── scoring.ts                   # Report → score, delegates to aiService.computeOverallScore
│   │   │   ├── sendVerificationEmail.ts
│   │   │   └── storagePath.ts
│   │   │
│   │   └── app.ts
│   │
│   ├── server.ts                              # Entry point
│   ├── deploy.sh
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                                   # Secrets, not committed
│
└── frontend/                                  # React + Vite web app
    ├── public/
    │   ├── manifest.json
    │   ├── pcm-processor.js
    │   ├── survey.html
    │   └── sw.js
    │
    ├── scripts/
    │   ├── capture-og.mjs
    │   └── gen-icons.mjs
    │
    ├── src/
    │   ├── components/
    │   │   ├── landing/
    │   │   │   ├── HeroWords.tsx
    │   │   │   ├── InvestorMarquee.tsx
    │   │   │   ├── SectionReveal.tsx
    │   │   │   ├── SmoothScroll.tsx
    │   │   │   └── StatsBand.tsx
    │   │   ├── ui/
    │   │   │   └── UpgradeModal.tsx
    │   │   ├── AppLayout.tsx
    │   │   ├── ChartFrame.tsx
    │   │   ├── ErrorBoundary.tsx
    │   │   ├── FirstTimeTour.tsx
    │   │   ├── GoogleSignInButton.tsx
    │   │   ├── InstallPrompt.tsx
    │   │   ├── LegalLayout.tsx
    │   │   ├── Logo.tsx
    │   │   ├── ProtectedRoute.tsx
    │   │   ├── Skeleton.tsx
    │   │   ├── SlideDeckViewer.tsx
    │   │   ├── ThemeToggle.tsx
    │   │   └── VerifyEmail.tsx
    │   │
    │   ├── contexts/
    │   │   ├── AuthContext.tsx
    │   │   ├── BillingContext.tsx
    │   │   ├── SocketContext.tsx
    │   │   └── ThemeContext.tsx
    │   │
    │   ├── hooks/
    │   │   ├── useMediaRecorder.ts
    │   │   ├── usePublicPrice.ts
    │   │   ├── useReducedMotion.ts
    │   │   ├── useScreenCapture.ts
    │   │   └── useSessionRecorder.ts
    │   │
    │   ├── lib/
    │   │   ├── answerTips.ts
    │   │   ├── downloadFile.ts
    │   │   ├── entitlements.ts
    │   │   ├── legal.ts
    │   │   ├── plans.ts
    │   │   ├── repitch.ts
    │   │   ├── routes.ts
    │   │   ├── scroll.ts
    │   │   ├── sentiment.ts
    │   │   ├── sessionMode.ts
    │   │   └── utils.ts
    │   │
    │   ├── pages/
    │   │   ├── legal/                         # All legal pages
    │   │   ├── Analytics.tsx   
    │   │   ├── BillingReturn.tsx              
    │   │   ├── Dashboard.tsx
    │   │   ├── DeckCheck.tsx
    │   │   ├── ForgotPassword.tsx
    │   │   ├── LandingPage.tsx
    │   │   ├── LivePitchRoom.tsx
    │   │   ├── LoginPage.tsx
    │   │   ├── MyPitchesArchive.tsx
    │   │   ├── Onboarding.tsx
    │   │   ├── PitchDecksManagement.tsx
    │   │   ├── PitchReplayScreen.tsx
    │   │   ├── PostPitchReport.tsx
    │   │   ├── PrePitchSetup.tsx
    │   │   ├── PricingPage.tsx
    │   │   ├── ResetPassword.tsx
    │   │   ├── SettingsPage.tsx
    │   │   └── SignupPage.tsx
    │   │
    │   ├── App.tsx       
    │   ├── main.tsx    # React entry point
    │   ├── index.css                         
    │   ├── types.ts
    │   └── vite-env.d.ts
    │
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    ├── tsconfig.json
    └── .env.example
```

## Not listed

- Images, fonts, icons and logos (`assets/`, `email-assets/`, `.png`, `.svg`, `.jpeg`)
- `node_modules/`, `package-lock.json`, `.gitignore`, `.vscode/`



##  Chat Flow

Start Pitch 
  -> Many Buttons are avaliable to start that
   -> it redirects u to setUp page 
   -> fill the details ->.   This Code written in PrePitchSetup.tsx Room
   -> then there is form for enetering in room , form will take the pitch avalible there  then once u click on Enter Live Room -> it redirect u to  room page  , the form took all the values those are selecte  in the prepitch room 
   -> no you are on room pag with the text visible Enter Live Room then once u click  source file ->LivePitchRoom.tsx
   -> by clicking on that tht timer starts and u enterted in actiual room

   they asked u to mic acces 

   Features in this room ->

   1. Ai Judges 
   2.the big screen for youe deck , that can swao with your camar a
   3.then some livr room monitore screeen 
   4.live chat bot 
   5.mute , camar on/off , end call , some tips ,maximuze full view and hide deck , screen share
   6. timer
   7, no of attemos counter
   8. the connection status 
   9. they will give u full summary 

   1. NO full working 

   1. Once u entered 
   




