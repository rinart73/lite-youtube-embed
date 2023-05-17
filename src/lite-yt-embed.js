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
    async connectedCallback() {
        // init global config object if it doesn't exist
        window.LiteYTEmbedConfig = window.LiteYTEmbedConfig || {};

        this.videoId = this.getAttribute('videoid');

        let playBtnEl = this.querySelector('.lty-playbtn');
        // A label for the button takes priority over a [playlabel] attribute on the custom-element
        this.playLabel = (playBtnEl && playBtnEl.textContent.trim()) || this.getAttribute('playlabel') || 'Play';

        // Add preview image
        await this.addPreview();

        // Set up play button, and its visually hidden label
        if (!playBtnEl) {
            playBtnEl = document.createElement('button');
            playBtnEl.type = 'button';
            playBtnEl.classList.add('lty-playbtn');
            this.append(playBtnEl);
        }
        if (!playBtnEl.textContent) {
            const playBtnLabelEl = document.createElement('span');
            playBtnLabelEl.className = 'lyt-visually-hidden';
            playBtnLabelEl.textContent = this.playLabel;
            playBtnEl.append(playBtnLabelEl);
        }
        playBtnEl.removeAttribute('href');

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
        this.needsYTApiForAutoplay = navigator.vendor.includes('Apple') || navigator.userAgent.includes('Mobi');
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
    async addPreview() {
        if (this.querySelector('.lty-preview-container')) {
            // Preview was added manually
            return;
        }

        // TODO: Add an option that would check in background if an image of selected size exists and use fallbacks
        this.preview = this.getAttribute('preview') || window.LiteYTEmbedConfig.preview || 'hq';

        // Detect preview dimensions
        let width, height;
        switch (this.preview) {
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
            default:
                // anything else is treated as incorrect value
                return;
        }

        // Custom jpg preview
        this.jpg = this.getAttribute('jpg');

        /**
         * Webp:
         * [yes] - default YouTube image
         * [no] - if YouTube has no preview for this video
         * Anything else is treated like a custom image
         */
        // TODO: Add an option that would check in background if WebP exists instead of manual toggle
        this.webp = this.getAttribute('webp') || window.LiteYTEmbedConfig.webp || 'yes';

        const picture = document.createElement('picture');
        picture.className = 'lty-preview-container';

        if (this.webp !== 'no') {
            const source = document.createElement('source');
            source.setAttribute('type', 'image/webp');
            source.setAttribute(
                'srcset',
                this.webp === 'yes'
                    ? `https://i.ytimg.com/vi_webp/${this.videoId}/${this.preview}default.webp`
                    : this.webp
            );
            picture.appendChild(source);
        }

        const img = document.createElement('img');
        img.setAttribute('decoding', 'async');
        img.setAttribute('loading', 'lazy');
        if (width && height) {
            img.setAttribute('width', width);
            img.setAttribute('height', height);
        }
        img.setAttribute(
            'src',
            this.jpg ? this.jpg : `https://i.ytimg.com/vi/${this.videoId}/${this.preview}default.jpg`
        );
        img.setAttribute('alt', this.playLabel);
        img.setAttribute('title', this.playLabel);
        img.className = 'lty-preview';
        picture.appendChild(img);

        this.insertBefore(picture, this.firstChild);
    }

    async addYTPlayerIframe(params) {
        this.fetchYTPlayerApi();
        await this.ytApiPromise;

        const videoPlaceholderEl = document.createElement('div');
        this.append(videoPlaceholderEl);

        const paramsObj = Object.fromEntries(params.entries());

        new YT.Player(videoPlaceholderEl, {
            width: '100%',
            videoId: this.videoId,
            playerVars: paramsObj,
            events: {
                onReady: (event) => {
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
        // AFAIK, the encoding here isn't necessary for XSS, but we'll do it only because this is a URL
        // https://stackoverflow.com/q/64959723/89484
        iframeEl.src = `https://www.youtube-nocookie.com/embed/${this.videoId}?${params.toString()}`;
        this.append(iframeEl);

        // Set focus for a11y
        iframeEl.focus();
    }
}
// Register custom element
customElements.define('lite-youtube', LiteYTEmbed);
