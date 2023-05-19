"use strict";
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
class LiteYTEmbed extends HTMLElement {
    constructor() {
        super(...arguments);
        this.videoId = '';
        this.playlistId = '';
        // YouTube poster size
        this.size = '';
        // Custom JPG poster
        this.jpg = '';
        // WebP poster toggle or custom WebP poster
        this.webp = '';
        this.playLabelText = '';
    }
    static checkWebpSupport() {
        const elem = document.createElement('canvas');
        if (!!(elem.getContext && elem.getContext('2d'))) {
            return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        }
        return false;
    }
    /**
     * Begin pre-connecting to warm up the iframe load
     * Since the embed's network requests load within its iframe,
     *   preload/prefetch'ing them outside the iframe will only cause double-downloads.
     * So, the best we can do is warm up a few connections to origins that are in the critical path.
     *
     * Maybe `<link rel=preload as=document>` would work, but it's unsupported: http://crbug.com/593267
     * But TBH, I don't think it'll happen soon with Site Isolation and split caches adding serious complexity.
     */
    static warmConnections() {
        if (LiteYTEmbed.preconnected)
            return;
        // The iframe document and most of its subresources come right off youtube.com
        LiteYTEmbed.addPrefetch('preconnect', 'https://www.youtube-nocookie.com');
        // The botguard script is fetched off from google.com
        LiteYTEmbed.addPrefetch('preconnect', 'https://www.google.com');
        // Not certain if these ad related domains are in the critical path. Could verify with domain-specific throttling.
        LiteYTEmbed.addPrefetch('preconnect', 'https://googleads.g.doubleclick.net');
        LiteYTEmbed.addPrefetch('preconnect', 'https://static.doubleclick.net');
        LiteYTEmbed.preconnected = true;
    }
    /**
     * Add a <link rel={preload | preconnect} ...> to the head
     */
    static addPrefetch(kind, url) {
        const linkEl = document.createElement('link');
        linkEl.rel = kind;
        linkEl.href = url;
        document.head.append(linkEl);
    }
    /**
     * Invoked each time the custom element is appended into a document-connected element
     * See: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements
     */
    connectedCallback() {
        // init global config object if it doesn't exist
        window.LiteYTEmbedConfig = window.LiteYTEmbedConfig || {};
        this.videoId = this.getAttribute('videoid') || '';
        this.playlistId = this.getAttribute('playlistid') || '';
        let playBtnEl = this.querySelector('.lyt-playbtn');
        // A label for the button takes priority over a [playlabel] attribute on the custom-element
        this.playLabelText =
            playBtnEl?.textContent?.trim() || this.getAttribute('playlabel') || window.LiteYTEmbedConfig.playLabel || 'Play';
        // title in the top left corner
        let showTitle = this.getAttribute('showtitle') || window.LiteYTEmbedConfig.showTitle || 'no';
        if (showTitle === 'yes') {
            let titleEl = this.querySelector('.lyt-title');
            if (!titleEl) {
                titleEl = document.createElement('div');
                titleEl.className = 'lyt-title';
                this.append(titleEl);
            }
            if (!titleEl.textContent) {
                const titleTextEl = document.createElement('span');
                titleTextEl.textContent = this.playLabelText;
                titleEl.append(titleTextEl);
            }
        }
        this.addPoster();
        // Set up play button, and its visually hidden label
        if (!playBtnEl) {
            playBtnEl = document.createElement('button');
            playBtnEl.type = 'button';
            playBtnEl.className = 'lyt-playbtn';
            this.append(playBtnEl);
        }
        if (!playBtnEl.textContent) {
            const playBtnLabelEl = document.createElement('span');
            playBtnLabelEl.className = 'lyt-visually-hidden';
            playBtnLabelEl.textContent = this.playLabelText;
            playBtnEl.append(playBtnLabelEl);
        }
        // progressive enhancement - remove `a` link attributes
        playBtnEl.removeAttribute('href');
        playBtnEl.removeAttribute('target');
        // On hover (or tap), warm up the TCP connections we're (likely) about to use.
        this.addEventListener('pointerover', LiteYTEmbed.warmConnections, { once: true });
        // Once the user clicks, add the real iframe and drop our play button
        // TODO: In the future we could be like amp-youtube and silently swap in the iframe during idle time
        //   We'd want to only do this for in-viewport or near-viewport ones: https://github.com/ampproject/amphtml/pull/5003
        this.addEventListener('click', this.addIframe);
        // Chrome & Edge desktop have no problem with the basic YouTube Embed with ?autoplay=1
        // However Safari desktop and most/all mobile browsers do not successfully track the user gesture of clicking through the creation/loading of the iframe,
        // so they don't autoplay automatically. Instead we must load an additional 2 sequential JS files (1KB + 165KB) (un-br) for the YT Player API
        // TODO: Try loading the the YT API in parallel with our iframe and then attaching/playing it. #82
        // API can be force-loaded via config
        if (LiteYTEmbed.usesApi === undefined) {
            LiteYTEmbed.usesApi =
                window.LiteYTEmbedConfig.forceApi || navigator.vendor.includes('Apple') || navigator.userAgent.includes('Mobi');
        }
    }
    /**
     * Tries to add iframe via DOM manipulations or YouTube API
     */
    async addIframe() {
        if (this.classList.contains('lyt-activated'))
            return;
        this.classList.add('lyt-activated');
        const params = new URLSearchParams(this.getAttribute('params') || window.LiteYTEmbedConfig?.params || '');
        params.append('autoplay', '1');
        params.append('playsinline', '1');
        // an attempt to fix "Failed to execute 'postMessage' on 'DOMWindow'"
        if (window.location.host) {
            params.append('origin', window.location.origin);
        }
        if (LiteYTEmbed.usesApi) {
            // via API
            return this.addYTPlayerIframe(params);
        }
        // via DOM
        const iframeEl = document.createElement('iframe');
        iframeEl.width = '560';
        iframeEl.height = '315';
        iframeEl.title = this.playLabelText;
        iframeEl.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
        iframeEl.allowFullscreen = true;
        iframeEl.fetchPriority = 'high';
        if (this.playlistId) {
            iframeEl.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${this.playlistId}&${params.toString()}`;
        }
        else {
            iframeEl.src = `https://www.youtube-nocookie.com/embed/${this.videoId}?${params.toString()}`;
        }
        this.append(iframeEl);
        // Set focus for a11y
        iframeEl.focus();
        this.dispatchEvent(new CustomEvent('ready'));
    }
    // Adds JPG (+ WebP) poster image
    addPoster() {
        // TODO: Add fallback for progressively enhanced videos as well
        if (this.querySelector('.lyt-preview-container')) {
            // Preview was added manually, don't override
            return;
        }
        this.size = this.getAttribute('size') || window.LiteYTEmbedConfig?.size || 'hq';
        // validate preview size
        if (!['mq', 'hq', 'sd', 'maxres'].includes(this.size))
            return;
        // Custom jpg preview
        this.jpg = this.getAttribute('jpg') || '';
        /**
         * 'yes' - default YouTube image
         * 'no' - typically used if YouTube has no preview for this video
         * Anything else is treated like a custom image
         */
        this.webp = this.getAttribute('webp') || window.LiteYTEmbedConfig?.webp || 'yes';
        // Check if browser supports WebP
        if (LiteYTEmbed.supportsWebp === undefined) {
            LiteYTEmbed.supportsWebp = LiteYTEmbed.checkWebpSupport();
        }
        if (!LiteYTEmbed.supportsWebp) {
            this.webp = 'no';
        }
        let posterContainer = document.createElement('picture');
        posterContainer.className = 'lyt-poster-container';
        // Add WebP source if allowed
        if (this.webp !== 'no') {
            const source = document.createElement('source');
            source.setAttribute('type', 'image/webp');
            source.setAttribute('srcset', this.webp === 'yes' ? `https://i.ytimg.com/vi_webp/${this.videoId}/${this.size}default.webp` : this.webp);
            posterContainer.appendChild(source);
        }
        this.posterEl = document.createElement('img');
        this.posterEl.setAttribute('decoding', 'async');
        this.posterEl.setAttribute('loading', 'lazy');
        this.setPosterDimensions();
        this.posterEl.setAttribute('src', this.jpg ? this.jpg : `https://i.ytimg.com/vi/${this.videoId}/${this.size}default.jpg`);
        this.posterEl.setAttribute('alt', this.playLabelText);
        this.posterEl.setAttribute('title', this.playLabelText);
        this.posterEl.className = 'lyt-poster';
        if (window.LiteYTEmbedConfig?.useFallback) {
            this.classList.add('lyt-poster-hidden');
            this.onPosterLoad = this.onPosterLoad.bind(this);
            this.onPosterError = this.onPosterError.bind(this);
            if (this.posterEl.complete) {
                this.onPosterLoad();
            }
            this.posterEl.addEventListener('load', this.onPosterLoad);
            this.posterEl.addEventListener('error', this.onPosterError);
        }
        posterContainer.appendChild(this.posterEl);
        this.insertBefore(posterContainer, this.firstChild);
    }
    // Sets poster image dimensions based on 'size' attribute
    setPosterDimensions() {
        let width, height;
        switch (this.size) {
            case 'mq':
                width = 320;
                height = 180;
                break;
            case 'hq':
                width = 480;
                height = 360;
                break;
            case 'sd':
                width = 640;
                height = 480;
                break;
            case 'maxres':
            default:
                width = 1280;
                height = 720;
                break;
        }
        this.posterEl?.setAttribute('width', width.toString());
        this.posterEl?.setAttribute('height', height.toString());
    }
    tryDownscalingSize() {
        switch (this.size) {
            case 'maxres':
                this.size = 'sd';
                return true;
            case 'sd':
                this.size = 'hq';
                return true;
        }
        /**
         * I think(?) a video should always have at least a 'hq' poster so if it doesn't exist,
         * then likely a video has no poster of that format at all.
         */
        return false;
    }
    onPosterLoad() {
        // YouTube 'no-poster' gray thumbnail has width of 120
        if ((this.posterEl?.naturalWidth || 0) <= 120) {
            this.onPosterError();
            return;
        }
        this.classList.remove('lyt-poster-hidden');
    }
    onPosterError() {
        let source = this.querySelector('source');
        if (source) {
            // we have WebP source
            if (this.webp !== 'yes') {
                // invalid custom WebP image, fallback to default
                this.webp = 'yes';
                source.setAttribute('srcset', `https://i.ytimg.com/vi_webp/${this.videoId}/${this.size}default.webp`);
                return;
            }
            // invalid default WebP image, downscale
            if (this.tryDownscalingSize()) {
                this.setPosterDimensions();
                source.setAttribute('srcset', `https://i.ytimg.com/vi_webp/${this.videoId}/${this.size}default.webp`);
                return;
            }
            // nowhere to downscale, WebP likely doesn't exist
            source.remove();
            this.webp = 'no';
            this.posterEl?.setAttribute('src', `https://i.ytimg.com/vi/${this.videoId}/${this.size}default.jpg`);
            return;
        }
        // working with jpg
        if (this.jpg) {
            // incorrect custom JPG image, fallback to default
            this.jpg = '';
            this.posterEl?.setAttribute('src', `https://i.ytimg.com/vi/${this.videoId}/${this.size}default.jpg`);
            return;
        }
        // invalid default JPG image, downscale
        if (this.tryDownscalingSize()) {
            this.setPosterDimensions();
            this.posterEl?.setAttribute('src', `https://i.ytimg.com/vi/${this.videoId}/${this.size}default.jpg`);
        }
        // nowhere to downscale, ignore
        //? Perhaps allow to set custom final fallback image
    }
    async addYTPlayerIframe(params) {
        await this.fetchYTPlayerApi();
        const videoPlaceholderEl = document.createElement('div');
        this.append(videoPlaceholderEl);
        const options = {
            width: '100%',
            host: 'https://www.youtube-nocookie.com',
            events: {
                onReady: (event) => {
                    this.api = event.target;
                    this.api.playVideo();
                    this.dispatchEvent(new CustomEvent('ready'));
                },
            },
        };
        if (this.playlistId) {
            params.append('listType', 'playlist');
            params.append('list', this.playlistId);
        }
        else {
            options.videoId = this.videoId;
        }
        options.playerVars = Object.fromEntries(params.entries());
        new YT.Player(videoPlaceholderEl, options);
    }
    /**
     * Dynamically load YouTube iframe API
     */
    fetchYTPlayerApi() {
        if (window.YT)
            return;
        return new Promise((res, rej) => {
            var el = document.createElement('script');
            el.src = 'https://www.youtube.com/iframe_api';
            el.async = true;
            el.onload = () => {
                window.YT?.ready(res);
            };
            el.onerror = rej;
            this.append(el);
        });
    }
}
LiteYTEmbed.preconnected = false;
customElements.define('lite-youtube', LiteYTEmbed);
