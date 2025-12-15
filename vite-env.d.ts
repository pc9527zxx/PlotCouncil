interface ImportMetaEnv {
  readonly VITE_RENDER_API_URL: string;
  readonly GEMINI_API_KEY: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
