/// <reference types="youtube" />
export interface LiteYTEmbedConfig {
    playLabel?: string;
    showTitle?: string;
    size?: string;
    webp?: string;
    useFallback?: boolean;
    params?: string;
    forceApi?: boolean;
}
declare global {
    interface Window {
        LiteYTEmbedConfig?: LiteYTEmbedConfig;
        YT?: typeof YT & {
            ready(callback: (value: unknown) => void): void;
        };
    }
    interface HTMLIFrameElement {
        fetchPriority: 'high' | 'low' | 'auto';
    }
}
