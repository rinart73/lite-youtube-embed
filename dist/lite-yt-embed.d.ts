/// <reference types="youtube" />
interface LiteYTEmbedConfig {
    playLabel?: string;
    showTitle?: string;
    size?: string;
    webp?: string;
    useFallback?: boolean;
    params?: string;
    forceApi?: boolean;
}
interface Window {
    LiteYTEmbedConfig?: LiteYTEmbedConfig;
    YT?: typeof YT & {
        ready(callback: (value: unknown) => void): void;
    };
}
interface HTMLIFrameElement {
    fetchPriority: 'high' | 'low' | 'auto';
}
/**
 * A lightweight youtube embed. Still should feel the same to the user, just MUCH faster to initialize and paint.
 *
 * Thx to these as the inspiration
 *   https://storage.googleapis.com/amp-vs-non-amp/youtube-lazy.html
 *   https://autoplay-youtube-player.glitch.me/
 *
 * Once built it, I also found these:
 *   https://github.com/ampproject/amphtml/blob/master/extensions/amp-youtube (👍👍)
 *   https://github.com/Daugilas/lazyYT
 *   https://github.com/vb/lazyframe
 */
declare class LiteYTEmbed extends HTMLElement {
    private static supportsWebp?;
    private static preconnected;
    private static usesApi?;
    videoId: string;
    size: string;
    jpg: string;
    webp: string;
    api?: YT.Player;
    private playLabelText;
    private posterEl?;
    private static checkWebpSupport;
    /**
     * Begin pre-connecting to warm up the iframe load
     * Since the embed's network requests load within its iframe,
     *   preload/prefetch'ing them outside the iframe will only cause double-downloads.
     * So, the best we can do is warm up a few connections to origins that are in the critical path.
     *
     * Maybe `<link rel=preload as=document>` would work, but it's unsupported: http://crbug.com/593267
     * But TBH, I don't think it'll happen soon with Site Isolation and split caches adding serious complexity.
     */
    private static warmConnections;
    /**
     * Add a <link rel={preload | preconnect} ...> to the head
     */
    private static addPrefetch;
    /**
     * Invoked each time the custom element is appended into a document-connected element
     * See: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements
     */
    connectedCallback(): void;
    /**
     * Tries to add iframe via DOM manipulations or YouTube API
     */
    addIframe(): Promise<void>;
    private addPoster;
    private setPosterDimensions;
    private tryDownscalingSize;
    private onPosterLoad;
    private onPosterError;
    private addYTPlayerIframe;
    /**
     * Dynamically load YouTube iframe API
     */
    private fetchYTPlayerApi;
}
