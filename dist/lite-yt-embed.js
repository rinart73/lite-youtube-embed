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
    connectedCallback() {
        // init global config object if it doesn't exist
        window.LiteYTEmbedConfig = window.LiteYTEmbedConfig || {};

        this.videoId = this.getAttribute('videoid');

        let playBtnEl = this.querySelector('.lty-playbtn');
        // A label for the button takes priority over a [playlabel] attribute on the custom-element
        this.playLabel = (playBtnEl && playBtnEl.textContent.trim()) || this.getAttribute('playlabel') || 'Play';

        this.showTitle = this.getAttribute('showtitle') || window.LiteYTEmbedConfig.showTitle || 'no';
        if (this.showTitle === 'yes') {
            let titleEl = this.querySelector('.lty-title');
            if (!titleEl) {
                titleEl = document.createElement('div');
                titleEl.className = 'lty-title';
                this.append(titleEl);
            }
            titleEl.innerHTML = `<span>${this.playLabel}</span>`;
        }

        // Add preview image
        this.addPreview();

        // Set up play button, and its visually hidden label
        if (!playBtnEl) {
            playBtnEl = document.createElement('button');
            playBtnEl.type = 'button';
            playBtnEl.className = 'lty-playbtn';
            this.append(playBtnEl);
        }
        if (!playBtnEl.textContent) {
            const playBtnLabelEl = document.createElement('span');
            playBtnLabelEl.className = 'lyt-visually-hidden';
            playBtnLabelEl.textContent = this.playLabel;
            playBtnEl.append(playBtnLabelEl);
        }
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
        this.needsYTApiForAutoplay =
            window.LiteYTEmbedConfig.forceApi ||
            navigator.vendor.includes('Apple') ||
            navigator.userAgent.includes('Mobi');
    }

    /**
     * Add a <link rel={preload | preconnect} ...> to the head
     */
    static addPrefetch(kind, url, as) {
        const linkEl = document.createElement('link');
        linkEl.rel = kind;
        linkEl.href = url;
        if (as) {
            linkEl.as = as;
        }
        document.head.append(linkEl);
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
        if (LiteYTEmbed.preconnected) return;

        // The iframe document and most of its subresources come right off youtube.com
        LiteYTEmbed.addPrefetch('preconnect', 'https://www.youtube-nocookie.com');
        // The botguard script is fetched off from google.com
        LiteYTEmbed.addPrefetch('preconnect', 'https://www.google.com');

        // Not certain if these ad related domains are in the critical path. Could verify with domain-specific throttling.
        LiteYTEmbed.addPrefetch('preconnect', 'https://googleads.g.doubleclick.net');
        LiteYTEmbed.addPrefetch('preconnect', 'https://static.doubleclick.net');

        LiteYTEmbed.preconnected = true;
    }

    static checkWebPSupport() {
        const elem = document.createElement('canvas');

        if (!!(elem.getContext && elem.getContext('2d'))) {
            return elem.toDataURL('image/webp').indexOf('data:image/webp') == 0;
        }

        return false;
    }

    fetchYTPlayerApi() {
        if (window.YT || (window.YT && window.YT.Player)) return;

        this.ytApiPromise = new Promise((res, rej) => {
            var el = document.createElement('script');
            el.src = 'https://www.youtube.com/iframe_api';
            el.async = true;
            el.onload = (_) => {
                YT.ready(res);
            };
            el.onerror = rej;
            this.append(el);
        });
    }

    /**
     * Adds placeholder/preview image
     * [mq]default - 320x180
     * [hq]default - 480x360
     * [sd]default - 640x480
     * [maxres]default - 1280x720
     */
    addPreview() {
        if (this.querySelector('.lty-preview-container')) {
            // Preview was added manually
            return;
        }

        this.size = this.getAttribute('size') || window.LiteYTEmbedConfig.size || 'hq';
        // validate preview size
        if (!['mq', 'hq', 'sd', 'maxres'].includes(this.size)) return;

        // Custom jpg preview
        this.jpg = this.getAttribute('jpg');

        /**
         * Webp:
         * [yes] - default YouTube image
         * [no] - typically used if YouTube has no preview for this video
         * Anything else is treated like a custom image
         */
        this.webp = this.getAttribute('webp') || window.LiteYTEmbedConfig.webp || 'yes';

        // Check if browser supports WebP
        if (LiteYTEmbed.supportsWebP === undefined) {
            LiteYTEmbed.supportsWebP = LiteYTEmbed.checkWebPSupport();
        }
        if (!LiteYTEmbed.supportsWebP) {
            this.webp = 'no';
        }

        this.previewContainer = document.createElement('picture');
        this.previewContainer.className = 'lty-preview-container';

        if (this.webp !== 'no') {
            const source = document.createElement('source');
            source.setAttribute('type', 'image/webp');
            source.setAttribute(
                'srcset',
                this.webp === 'yes' ? `https://i.ytimg.com/vi_webp/${this.videoId}/${this.size}default.webp` : this.webp
            );
            this.previewContainer.appendChild(source);
        }

        this.previewImage = document.createElement('img');
        this.previewImage.setAttribute('decoding', 'async');
        this.previewImage.setAttribute('loading', 'lazy');

        this.setImageDimensions();

        this.previewImage.setAttribute(
            'src',
            this.jpg ? this.jpg : `https://i.ytimg.com/vi/${this.videoId}/${this.size}default.jpg`
        );
        this.previewImage.setAttribute('alt', this.playLabel);
        this.previewImage.setAttribute('title', this.playLabel);
        this.previewImage.className = 'lty-preview';

        // If a poster fails to load, use fallbacks
        if (window.LiteYTEmbedConfig.useFallback) {
            this.onPosterLoad = this.onPosterLoad.bind(this);
            this.onPosterError = this.onPosterError.bind(this);
            this.previewImage.addEventListener('load', this.onPosterLoad);
            this.previewImage.addEventListener('error', this.onPosterError);
        }

        this.previewContainer.appendChild(this.previewImage);

        this.insertBefore(this.previewContainer, this.firstChild);
    }

    onPosterLoad() {
        // YouTube 'no-poster' thumbnail has width of 120
        if (this.previewImage.naturalWidth <= 120) {
            this.onPosterError();
        }
    }

    onPosterError() {
        let source = this.querySelector('source');
        if (source) {
            // we have WebP source
            if (this.webp !== 'yes') {
                // incorrect custom WebP image, fallback to default
                this.webp = 'yes';
                source.setAttribute('srcset', `https://i.ytimg.com/vi_webp/${this.videoId}/${this.size}default.webp`);
                return;
            }
            // perhaps requested default WebP image is too big, downgrade
            if (!this.tryDowngradingSize()) {
                source.remove();
                source = null;
                this.webp = 'no';
            }
            // update the image with a new size
            this.setImageDimensions();
            if (source) {
                source.setAttribute('srcset', `https://i.ytimg.com/vi_webp/${this.videoId}/${this.size}default.webp`);
            } else {
                this.previewImage.setAttribute('src', `https://i.ytimg.com/vi/${this.videoId}/${this.size}default.jpg`);
            }
            return;
        }

        // source doesn't exist, we're dealing with WebP

        if (this.jpg) {
            // incorrect custom JPG image, fallback to default
            this.jpg = null;
            this.previewImage.setAttribute('src', `https://i.ytimg.com/vi/${this.videoId}/${this.size}default.jpg`);
            return;
        }

        if (this.size === 'hq') {
            // nowhere to downgrade
            return;
        }

        // downgrade jpg poster
        this.tryDowngradingSize();
        this.previewImage.setAttribute('src', `https://i.ytimg.com/vi/${this.videoId}/${this.size}default.jpg`);
    }

    tryDowngradingSize() {
        switch (this.size) {
            case 'maxres':
                this.size = 'sd';
                return true;
            case 'sd':
                this.size = 'hq';
                return true;
            /**
             * I think(?) a video should always have at least a 'hq' poster so if it doesn't exist,
             * then likely a video has no (WebP) poster at all.
             */
            default:
                return false;
        }
    }

    setImageDimensions() {
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
                width = 1280;
                height = 720;
                break;
        }
        this.previewImage.setAttribute('width', width);
        this.previewImage.setAttribute('height', height);
    }

    async addYTPlayerIframe(params) {
        this.fetchYTPlayerApi();
        await this.ytApiPromise;

        const videoPlaceholderEl = document.createElement('div');
        this.append(videoPlaceholderEl);

        const paramsObj = Object.fromEntries(params.entries());

        new YT.Player(videoPlaceholderEl, {
            width: '100%',
            host: 'https://www.youtube-nocookie.com',
            videoId: this.videoId,
            playerVars: paramsObj,
            events: {
                onReady: (event) => {
                    this.api = event.target;
                    event.target.playVideo();
                }
            }
        });
    }

    async addIframe() {
        if (this.classList.contains('lyt-activated')) return;
        this.classList.add('lyt-activated');

        const params = new URLSearchParams(this.getAttribute('params') || window.LiteYTEmbedConfig.params || '');
        params.append('autoplay', '1');
        params.append('playsinline', '1');

        if (this.needsYTApiForAutoplay) {
            return this.addYTPlayerIframe(params);
        }

        const iframeEl = document.createElement('iframe');
        iframeEl.width = 560;
        iframeEl.height = 315;
        // No encoding necessary as [title] is safe. https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#:~:text=Safe%20HTML%20Attributes%20include
        iframeEl.title = this.playLabel;
        iframeEl.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
        iframeEl.allowFullscreen = true;
        iframeEl.src = `https://www.youtube-nocookie.com/embed/${this.videoId}?${params.toString()}`;
        this.append(iframeEl);

        // Set focus for a11y
        iframeEl.focus();
    }
}
// Register custom element
customElements.define('lite-youtube', LiteYTEmbed);
