interface LiteYTEmbedConfig {
  playLabel?: string;
  showTitle?: string;
  size?: string;
  webp?: string;
  useFallback?: boolean;
  params?: string;
  forceApi?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Window {
  LiteYTEmbedConfig?: LiteYTEmbedConfig;
  YT?: typeof YT & {
    ready: (callback: (value: unknown) => void) => void;
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
class LiteYTEmbed extends HTMLElement {
  private static supportsWebp?: boolean;
  private static preconnected = false;
  private static usesApi?: boolean;

  public videoId = '';
  public playlistId = '';
  /**
   * YouTube poster size
   */
  public size = '';
  /**
   * Custom JPG poster
   */
  public jpg = '';
  /**
   * WebP poster toggle or custom WebP poster
   */
  public webp = '';
  /**
   * API Player instance
   */
  public api?: YT.Player;
  private isInitialized?: boolean;
  private playLabelText = '';
  /**
   * Poster img element
   */
  private posterEl?: HTMLImageElement;

  /**
   * Returns an array of attribute names that should be observed for change
   */
  public static get observedAttributes(): string[] {
    return ['videoid', 'playlistid', 'playlabel', 'showtitle', 'params' /* , 'size', 'jpg', 'webp' */];
  }

  private static checkWebpSupport(): boolean {
    const elem = document.createElement('canvas');

    if (elem.getContext?.('2d') != null) {
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
  private static warmConnections(): void {
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

  /**
   * Add a <link rel={preload | preconnect} ...> to the head
   */
  private static addPrefetch(kind: string, url: string): void {
    const linkEl = document.createElement('link');
    linkEl.rel = kind;
    linkEl.href = url;
    document.head.append(linkEl);
  }

  /**
   * Invoked each time the custom element is appended into a document-connected element
   * See: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements
   */
  public connectedCallback(): void {
    // connectedCallback may be called once the element is no longer connected, use Node.isConnected to make sure
    if (!this.isConnected) return;

    // make sure that the element is not being processed more than once
    if (this.isInitialized === true) return;

    // init global config object if it doesn't exist
    window.LiteYTEmbedConfig = window.LiteYTEmbedConfig ?? {};

    this.videoId = this.getAttribute('videoid') ?? '';
    this.playlistId = this.getAttribute('playlistid') ?? '';

    // Set up play button, and its visually hidden label
    let playBtnEl: HTMLButtonElement | null = this.querySelector('.lyt-playbtn');
    if (playBtnEl == null) {
      playBtnEl = document.createElement('button');
      playBtnEl.type = 'button';
      playBtnEl.className = 'lyt-playbtn';
      this.append(playBtnEl);
    }
    let playBtnLabelEl = playBtnEl.querySelector('span');
    if (playBtnLabelEl == null) {
      playBtnLabelEl = document.createElement('span');
      playBtnLabelEl.className = 'lyt-visually-hidden';
      playBtnEl.append(playBtnLabelEl);
    }
    playBtnLabelEl.textContent = window.LiteYTEmbedConfig?.playLabel ?? 'Play';

    // progressive enhancement - remove `a` link attributes
    playBtnEl.removeAttribute('href');
    playBtnEl.removeAttribute('target');

    this.addPoster();

    // On hover (or tap), warm up the TCP connections we're (likely) about to use.
    this.addEventListener('pointerover', LiteYTEmbed.warmConnections, { once: true });

    // Once the user clicks, add the real iframe and drop our play button
    // TODO: In the future we could be like amp-youtube and silently swap in the iframe during idle time
    //   We'd want to only do this for in-viewport or near-viewport ones: https://github.com/ampproject/amphtml/pull/5003
    this.addIframe = this.addIframe.bind(this);
    this.addEventListener('click', () => {
      this.addIframe();
    });

    // Chrome & Edge desktop have no problem with the basic YouTube Embed with ?autoplay=1
    // However Safari desktop and most/all mobile browsers do not successfully track the user gesture of clicking through the creation/loading of the iframe,
    // so they don't autoplay automatically. Instead we must load an additional 2 sequential JS files (1KB + 165KB) (un-br) for the YT Player API
    // TODO: Try loading the the YT API in parallel with our iframe and then attaching/playing it. #82
    // API can be force-loaded via config
    if (LiteYTEmbed.usesApi === undefined) {
      LiteYTEmbed.usesApi =
        window.LiteYTEmbedConfig.forceApi ??
        (navigator.vendor.includes('Apple') || navigator.userAgent.includes('Mobi'));
    }

    this.isInitialized = true;

    /**
     * Trigger manual update for the some attributes if they're empty
     * because their values could be set in the global config.
     */
    ['playlabel', 'showtitle', 'params' /* , 'size', 'webp' */].forEach((attribute) => {
      if (this.getAttribute(attribute) == null) {
        this.attributeChangedCallback(attribute);
      }
    });
  }

  /**
   * Run whenever one of the element's attributes is changed in some way
   */
  public attributeChangedCallback(name: string, oldValue: string | null = null, newValue: string | null = null): void {
    // ignore matching old and new value unless both are null (which would mean manual update)
    if (oldValue === newValue && oldValue !== null) return;

    /**
     * When an attribute is updated:
     * * `showtitle` - Create or remove title element
     * * `playlabel` - Update play button text, title text, poster title/alt attributes, iframe title attribute
     * * If iframe isn't loaded yet:
     * * * `size` - Update poster, restart fallback?
     * * * `jpg` - Update poster, restart fallback?
     * * * `webp` - Update poster, restart fallback?
     * * * `videoid` - Update poster, restart fallback?
     * * * `playlistid` - Do nothing
     * * * `params` - Do nothing
     * * If iframe is already loaded:
     * * * `size` - Do nothing
     * * * `jpg` - Do nothing
     * * * `webp` - Do nothing
     * * * `params` - Re-create iframe
     * * * If using DOM:
     * * * * `videoid` - If playlistid is empty then update iframe href, otherwise do nothing
     * * * * `playlistid` - Update iframe href
     * * * If using Player API:
     * * * * `videoid` - If playlistid is empty then api.loadVideoById, otherwise do nothing
     * * * * `playlistid` - If playlist is empty then api.loadVideoById, otherwise api.loadPlaylist
     */

    // Typically contains the name of a video
    if (name === 'playlabel') {
      const defaultLabelText = window.LiteYTEmbedConfig?.playLabel ?? 'Play';
      this.playLabelText = newValue ?? defaultLabelText;

      // update play button hidden text
      const playBtnLabelEl = this.querySelector('.lyt-playbtn span');
      if (playBtnLabelEl != null) {
        playBtnLabelEl.textContent = this.playLabelText;
      }

      // update top left title
      const titleEl = this.querySelector('.lyt-title span');
      if (titleEl != null) {
        // don't show default 'Play' as title
        titleEl.textContent = this.playLabelText !== defaultLabelText ? newValue : '';
      }

      // update poster alt and title
      const posterEl = this.querySelector('.lyt-poster');
      if (posterEl != null) {
        posterEl.setAttribute('alt', this.playLabelText);
        posterEl.setAttribute('title', this.playLabelText);
      }

      // update iframe title
      const iframe = this.querySelector('iframe');
      if (iframe != null) {
        iframe.setAttribute('title', this.playLabelText);
      }

      return;
    }

    // 'yes' | 'no' - Shows or hides video title in the top left corner
    if (name === 'showtitle') {
      const showTitle = newValue ?? window.LiteYTEmbedConfig?.showTitle ?? 'no';
      let titleEl = this.querySelector('.lyt-title');

      if (showTitle === 'yes') {
        // create if doesn't exist
        if (titleEl == null) {
          titleEl = document.createElement('div');
          titleEl.className = 'lyt-title';
          this.append(titleEl);
        }
        let titleTextEl = titleEl.querySelector('span');
        if (titleTextEl == null) {
          titleTextEl = document.createElement('span');
          titleEl.append(titleTextEl);
        }
        const defaultLabelText = window.LiteYTEmbedConfig?.playLabel ?? 'Play';
        // don't show default 'Play' as title
        titleTextEl.textContent = this.playLabelText !== defaultLabelText ? this.playLabelText : '';

        return;
      }

      // 'no' - remove if exists
      if (titleEl != null) {
        titleEl.remove();
      }

      return;
    }

    // YouTube video
    if (name === 'videoid') {
      this.videoId = newValue ?? '';

      if (!this.classList.contains('lyt-activated')) {
        // TODO: no iframe - update poster, restart fallback

        return;
      }

      // playlist takes priority over video
      if (this.playlistId !== '' || this.videoId === '') return;

      // load new video
      this.addIframe(true);

      return;
    }

    // YouTube playlist
    if (name === 'playlistid') {
      this.playlistId = newValue ?? '';

      if (!this.classList.contains('lyt-activated')) {
        // no iframe - do nothing
        return;
      }

      // no playlist and no video = do nothing
      if (this.playlistId === '' && this.videoId === '') return;

      // load new playlist or video
      this.addIframe(true);

      return;
    }

    // Player parameters / playerVars
    if (name === 'params') {
      if (!this.classList.contains('lyt-activated')) {
        // no iframe - do nothing
        return;
      }

      // recreate iframe
      this.api = undefined;
      this.querySelector('iframe')?.remove();
      this.addIframe(true);

      return;
    }
  }

  /**
   * Tries to add iframe via DOM manipulations or YouTube API
   */
  public addIframe(force = false): void {
    if (!force && this.classList.contains('lyt-activated')) return;
    this.classList.add('lyt-activated');

    const params = new URLSearchParams(this.getAttribute('params') ?? window.LiteYTEmbedConfig?.params ?? '');
    params.append('autoplay', '1');
    params.append('playsinline', '1');

    // an attempt to fix "Failed to execute 'postMessage' on 'DOMWindow'"
    if (window.location.host !== '') {
      params.append('origin', window.location.origin);
    }

    if (LiteYTEmbed.usesApi === true) {
      // via API
      void this.addYTPlayerIframe(params);
      return;
    }

    // via DOM
    let iframeEl = this.querySelector('iframe');
    let isNewIframe = false;
    if (iframeEl == null) {
      isNewIframe = true;
      iframeEl = document.createElement('iframe');
      iframeEl.width = '560';
      iframeEl.height = '315';
      iframeEl.title = this.playLabelText;
      iframeEl.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      iframeEl.allowFullscreen = true;
      iframeEl.fetchPriority = 'high';
      this.append(iframeEl);
    }
    if (this.playlistId !== '') {
      iframeEl.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${this.playlistId}&${params.toString()}`;
    } else {
      iframeEl.src = `https://www.youtube-nocookie.com/embed/${this.videoId}?${params.toString()}`;
    }

    // Set focus for a11y
    iframeEl.focus();

    if (isNewIframe) {
      this.dispatchEvent(new CustomEvent('ready'));
    }
  }

  /**
   * Adds JPG (+ WebP) poster image
   */
  private addPoster(): void {
    // TODO: Add fallback for progressively enhanced videos as well

    if (this.querySelector('.lyt-poster-container') != null) {
      // Poster was added manually, don't override
      return;
    }

    this.size = this.getAttribute('size') ?? window.LiteYTEmbedConfig?.size ?? 'hq';
    // validate poster size
    if (!['mq', 'hq', 'sd', 'maxres'].includes(this.size)) return;

    // Custom jpg poster
    this.jpg = this.getAttribute('jpg') ?? '';

    /**
     * 'yes' - default YouTube image
     * 'no' - typically used if YouTube has no poster for this video
     * Anything else is treated like a custom image
     */
    this.webp = this.getAttribute('webp') ?? window.LiteYTEmbedConfig?.webp ?? 'yes';

    // don't create poster if none is specified
    if (this.videoId === '' && this.jpg === '') return;

    // Check if browser supports WebP
    if (LiteYTEmbed.supportsWebp === undefined) {
      LiteYTEmbed.supportsWebp = LiteYTEmbed.checkWebpSupport();
    }
    if (!LiteYTEmbed.supportsWebp) {
      this.webp = 'no';
    }

    const posterContainer = document.createElement('picture');
    posterContainer.className = 'lyt-poster-container';

    // Add WebP source if allowed
    if (this.webp !== 'no') {
      const source = document.createElement('source');
      source.setAttribute('type', 'image/webp');
      source.setAttribute(
        'srcset',
        this.webp === 'yes' ? `https://i.ytimg.com/vi_webp/${this.videoId}/${this.size}default.webp` : this.webp,
      );
      posterContainer.appendChild(source);
    }

    this.posterEl = document.createElement('img');
    this.posterEl.setAttribute('decoding', 'async');
    this.posterEl.setAttribute('loading', 'lazy');

    this.setPosterDimensions();

    this.posterEl.setAttribute(
      'src',
      this.jpg !== '' ? this.jpg : `https://i.ytimg.com/vi/${this.videoId}/${this.size}default.jpg`,
    );
    this.posterEl.setAttribute('alt', this.playLabelText);
    this.posterEl.setAttribute('title', this.playLabelText);
    this.posterEl.className = 'lyt-poster';

    if (window.LiteYTEmbedConfig?.useFallback === true) {
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
  private setPosterDimensions(): void {
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

  private tryDownscalingSize(): boolean {
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

  private onPosterLoad(): void {
    // YouTube 'no-poster' gray thumbnail has width of 120
    if ((this.posterEl?.naturalWidth ?? 0) <= 120) {
      this.onPosterError();
      return;
    }

    this.classList.remove('lyt-poster-hidden');
  }

  private onPosterError(): void {
    const source = this.querySelector('source');
    if (source != null) {
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

    if (this.jpg !== '') {
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
    // ? Perhaps allow to set custom final fallback image
  }

  private async addYTPlayerIframe(params: URLSearchParams): Promise<void> {
    await this.fetchYTPlayerApi();

    if (this.api) {
      // Player was already initialized
      if (this.playlistId === '') {
        this.api.loadVideoById(this.videoId);
      } else {
        this.api.loadPlaylist({
          list: this.playlistId,
          listType: 'playlist',
        });
      }

      return;
    }

    const videoPlaceholderEl = document.createElement('div');
    this.append(videoPlaceholderEl);

    const options: YT.PlayerOptions = {
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

    if (this.playlistId === '') {
      options.videoId = this.videoId;
    } else {
      params.append('listType', 'playlist');
      params.append('list', this.playlistId);
    }

    options.playerVars = Object.fromEntries(params.entries());
    // eslint-disable-next-line no-new
    new YT.Player(videoPlaceholderEl, options);
  }

  /**
   * Dynamically load YouTube iframe API
   */
  private fetchYTPlayerApi(): Promise<unknown> | undefined {
    if (window.YT !== undefined) return;

    return new Promise((resolve, reject): void => {
      const el = document.createElement('script');
      el.src = 'https://www.youtube.com/iframe_api';
      el.async = true;
      el.onload = () => {
        window.YT?.ready(resolve);
      };
      el.onerror = reject;
      this.append(el);
    });
  }
}

customElements.define('lite-youtube', LiteYTEmbed);
