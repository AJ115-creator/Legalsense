import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
  release: import.meta.env.VITE_GIT_COMMIT_SHA || "dev",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration({
      autoInject: false,
      colorScheme: "system",
      showBranding: false,
      triggerLabel: "Feedback",
      formTitle: "Send Feedback",
      submitButtonLabel: "Submit",
      messagePlaceholder: "What can we improve? Found a bug?",
      successMessageText: "Thanks for your feedback!",
      themeLight: {
        background: "#f1f0e5",
        foreground: "#56453f",
        accentBackground: "#a37764",
        accentForeground: "#ffffff",
      },
      themeDark: {
        background: "#3c332e",
        foreground: "#f1f0e5",
        accentBackground: "#c39e88",
        accentForeground: "#2d2521",
      },
    }),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})
