# Lite YouTube Embed [![NPM lite-youtube-embed package](https://img.shields.io/npm/v/lite-youtube-embed.svg)](https://npmjs.org/package/lite-youtube-embed)

> #### Renders faster than a sneeze.

Provide videos with a supercharged focus on visual performance.
This custom element renders just like the real thing but approximately 224× faster.

Demo: https://rinart73.github.io/lite-youtube-embed/

## Comparison

| Normal `<iframe>` YouTube embed |  `lite-youtube` |
|---|---|
|  ![Screen Shot 2019-11-03 at 5 23 50 PM](https://user-images.githubusercontent.com/39191/68095560-5c930d00-fe5f-11e9-8104-e73e77a21287.png)   ![Screen Shot 2019-11-03 at 5 21 05 PM](https://user-images.githubusercontent.com/39191/68095562-5d2ba380-fe5f-11e9-8b5f-18f451b0716d.png)  ![Screen Shot 2019-11-03 at 5 19 35 PM](https://user-images.githubusercontent.com/39191/68095565-5d2ba380-fe5f-11e9-835d-85d37df71f52.png)  | ![Screen Shot 2019-11-03 at 5 23 27 PM](https://user-images.githubusercontent.com/39191/68095561-5d2ba380-fe5f-11e9-9393-e2206a64c8bf.png) ![Screen Shot 2019-11-03 at 5 20 55 PM](https://user-images.githubusercontent.com/39191/68095563-5d2ba380-fe5f-11e9-8f9a-f5c4a774cd56.png)  ![Screen Shot 2019-11-03 at 5 20 16 PM](https://user-images.githubusercontent.com/39191/68095564-5d2ba380-fe5f-11e9-908f-7e12eab8b2ad.png) |

## Basic usage

> **Note**
> This is a **fork**, so you'll have to download the files from the `dist/` folder. `lite-youtube-embed` npm package belongs to the original author.

To use the custom element you will need to:

1. Include the stylesheet within your application
2. Include the script as well
3. Use the `lite-youtube` tag via HTML or JS.
4. Be happy that you're providing a better user experience to your visitors

```html
<!-- Include the CSS & JS.. (This could be direct from the package or bundled) -->
<link rel="stylesheet" href="node_modules/lite-youtube-embed/src/lite-yt-embed.css" />

<script src="node_modules/lite-youtube-embed/src/lite-yt-embed.js"></script>

<!-- Use the element. You may use it before the lite-yt-embed JS is executed. -->
<lite-youtube videoid="ogfYd705cRs" playlabel="Play: Keynote (Google I/O '18)"></lite-youtube>
```

<br>

Privacy note: lite-youtube uses youtube-nocookie.com instead of youtube.com in order
to be more privacy friendly for end users.

### Custom Player Parameters

YouTube supports a variety of [player parameters](https://developers.google.com/youtube/player_parameters#Parameters) to control the iframe's behavior and appearance.
These may be applied by using the `params` attribute.

```html
<!-- Example to show a video player without controls, starting at 10s in, ending at 20s, with modest branding *and* enabling the JS API -->
<lite-youtube videoid="ogfYd705cRs" params="controls=0&start=10&end=30&modestbranding=2&rel=0&enablejsapi=1"></lite-youtube>
```

Note that lite-youtube uses `autoplay=1` by default.

Demo: https://rinart73.github.io/lite-youtube-embed/variants/params.html

## Pro-usage: load w/ JS deferred (aka progressive enhancement)

Use this as your HTML, load the script asynchronously, and let the JS progressively enhance it.

```html
<lite-youtube videoid="ogfYd705cRs">
  <picture class="lty-preview-container">
    <source type="image/webp" srcset="https://i.ytimg.com/vi_webp/ogfYd705cRs/hqdefault.webp">
    <img decoding="async" loading="lazy" width="480" height="360" src="https://i.ytimg.com/vi/ogfYd705cRs/hqdefault.jpg" alt="Play Video: Keynote (Google I/O '18)" title="Play Video: Keynote (Google I/O '18)" class="lty-preview">
  </picture>
  <a class="lty-playbtn" title="Play Video" href="https://youtube.com/watch?v=ogfYd705cRs" target="_blank">
    <span class="lyt-visually-hidden">Play Video: Keynote (Google I/O '18)</span>
  </a>
</lite-youtube>
```

Demo: https://rinart73.github.io/lite-youtube-embed/variants/pe.html

## Show title

Show video `playlabel` in the top left corner like YouTube does.
```html
<lite-youtube videoid="ogfYd705cRs" playlabel="Keynote (Google I/O '18)" showtitle="yes"></lite-youtube>
```

## Change poster size (resolution)

You can use the following values as the `size` atribute to set video poster size.

* mq - 320x180
* hq (default) - 480x360
* sd - 640x480
* maxres - 1280x720

Keep in mind that some videos might now have a high-resolution version of a poster and will instead display default YouTube gray poster.
```html
<lite-youtube videoid="ogfYd705cRs" size="maxres"></lite-youtube>
```

Demo: https://rinart73.github.io/lite-youtube-embed/variants/custom-poster-size.html

## Custom poster image

If you want to provide a custom poster image set the `jpg` and `webp` attributes:
```html
<lite-youtube videoid="ogfYd705cRs" jpg="https://example.com/my-custom-poster.jpg" webp="https://example.com/my-custom-poster.webp"></lite-youtube>
```

Demo: https://rinart73.github.io/lite-youtube-embed/variants/custom-poster-image.html

## Disable WebP

Setting `webp` attribute to `no` will disable it for the video:
```html
<lite-youtube videoid="ogfYd705cRs" jpg="https://example.com/my-custom-poster.jpg" webp="no"></lite-youtube>
```

Demo: https://rinart73.github.io/lite-youtube-embed/variants/no-webp.html

## Global config

You can set the following default values that will apply to all videos unless overridden in the `lite-youtube` tag:

```js
var LiteYTEmbedConfig = {
  // default title and label for play button
  playLabel: 'Play',
  // display title in top left corner
  showTitle: 'yes', // 'no'
  // YouTube poster size
  size: 'maxres',
  /**
   * 'yes' - tries to enable WebP
   * 'no' - disables WebP
   * Other value - acts like a custom WebP poster
   */
  webp: 'no',
  // if true, will try to use fallback posters
  useFallback: true,
  params: 'controls=0',
  // if true, will force-load YouTube API
  forceApi: true  
};
```

Demo: https://rinart73.github.io/lite-youtube-embed/variants/global-config.html

## Fallback poster

You can opt-in for a fallback mechanism that will try to find a working poster.

1. First your custom poster will be tried if it's defined.
2. Then high resolution YouTube default poster.
3. Then poster size will be downgraded until it reaches 'hq' WebP.
4. Then WebP will be dropped in favor of JPG.

The overall speed of this method depends on the amount of tries it will take to find a working poster. YouTube can be quite slow for some reason when you ask it for non-existing images.

```html
<script>
var LiteYTEmbedConfig = {
  useFallback: true
};
</script>

<lite-youtube videoid="pULNqYm4_uk" size="maxres"></lite-youtube>
```

Demo: https://rinart73.github.io/lite-youtube-embed/variants/fallback-poster.html

## Forceload API

You can make so YouTube API will be force-loaded no matter the browser after a user click any video. Then you can manipulate the video (start, pause, stop, change time etc).

```html
<script>
var LiteYTEmbedConfig = {
  forceAPI: true
};
</script>

<lite-youtube videoid="ogfYd705cRs"></lite-youtube>

<button id="btn-pause">Pause</button>

<script>
  document.querySelector('#btn-pause').addEventListener('click', () => {
    const liteYoutube = document.querySelector('lite-youtube');
    if(liteYouTube.api) {
      liteYouTube.api.pauseVideo();
    }
  })
</script>
```

Demo: https://rinart73.github.io/lite-youtube-embed/variants/forceload-api.html

## Playlists

Playlists are supported, but there is no lightweight way to automatically retrieve playlist thumbnail. So either specify first playlist video id in the `videoid` attribute to use its poster or use custom posters via `jpg` and `webp` attributes.</li>

```html
<lite-youtube videoid="K4DyBUG242c" playlistid="PLW-S5oymMexXTgRyT3BWVt_y608nt85Uj"></lite-youtube>
```

Demo: https://rinart73.github.io/lite-youtube-embed/variants/playlists.html

## Other fast YouTube embeds

* &lt;lite-youtube&gt; using shadow DOM: [`justinribeiro/lite-youtube`](https://github.com/justinribeiro/lite-youtube) :+1:
* React port 1: [`ibrahimcesar/react-lite-youtube-embed`](https://github.com/ibrahimcesar/react-lite-youtube-embed)
* React port 2: [`kylemocode/react-lite-yt-embed`](https://github.com/kylemocode/react-lite-yt-embed)
* Vue port: [`andrewvasilchuk/vue-lazy-youtube-video`](https://github.com/andrewvasilchuk/vue-lazy-youtube-video)
## Other [third-party facades](https://web.dev/third-party-facades/)

* Lite Vimeo Embed: [`luwes/lite-vimeo-embed`](https://github.com/luwes/lite-vimeo-embed)
* &lt;lite-vimeo&gt;: [`slightlyoff/lite-vimeo`](https://github.com/slightlyoff/lite-vimeo)
* React Live Chat Loader (Intercom, Help Scout, Drift, Facebook Messenger): [`calibreapp/react-live-chat-loader`](https://github.com/calibreapp/react-live-chat-loader)
* Intercom chat facade: [`danielbachhuber/intercom-facade/`](https://github.com/danielbachhuber/intercom-facade/)
