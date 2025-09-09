import { program } from "npm:commander";
import puppeteer from "npm:puppeteer";

function log(...data: unknown[]) {
  console.log(new Date().toISOString(), ...data);
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

declare interface mainOptions {
  debug: boolean;
  url: string;
  text: string;
  viewportSize: string;
  screenshotPath: `${string}.${puppeteer.ImageFormat}`;
}

async function main(options: mainOptions): Promise<void> {
  let browserConfig: puppeteer.LaunchOptions = {
    args: [
      "--start-maximized",
    ],
    headless: true,
  };
  if (options.debug) {
    browserConfig = {
      ...browserConfig,
      headless: false,
      devtools: true,
      slowMo: 250,
      dumpio: false,
    };
  }

  log("Launching the browser...");
  const browser = await puppeteer.launch(browserConfig);
  try {
    log(`Launched the ${await browser.version()} browser.`);

    const [page] = await browser.pages();

    log("Setting the browser viewport...");
    await page.setViewport({
      width: parseInt(options.viewportSize.split("x")[0], 10),
      height: parseInt(options.viewportSize.split("x")[1], 10),
      deviceScaleFactor: 1,
    });

    log("Setting the browser locale...");
    const cdpSession = await page.createCDPSession();
    await cdpSession.send("Emulation.setLocaleOverride", {
      locale: "en-IE",
    });
    await cdpSession.send("Emulation.setTimezoneOverride", {
      timezoneId: "Europe/Lisbon",
    });
    const data = await page.evaluate(() => {
      const timeFormatOptions = new Intl.DateTimeFormat().resolvedOptions();
      return {
        language: navigator.language,
        languages: navigator.languages,
        locale: timeFormatOptions.locale,
        timeZone: timeFormatOptions.timeZone,
      };
    });
    log(`Browser locale: ${JSON.stringify(data, null, 4)}`);

    try {
      log(`Loading ${options.url}...`);
      await page.goto(options.url);
      await page.waitForNetworkIdle();

      log("Waiting for JetKVM to be connected to the device...");
      await page.waitForFunction(() => {
        const transitions = new Map(
          Array.from(document.querySelectorAll("div.transition ~ span.transition"), el => {
            const key = el.parentElement.parentElement.parentElement.querySelector("div.transition").innerText.trim();
            const value = el.innerText.trim();
            return [key, value];
          })
        );
        return transitions.get("JetKVM Device") === "Connected" && transitions.get("USB") === "Connected";
      }, { timeout: 5000 });

      log("Going fullscreen...");
      await page.locator("button span::-p-text(Fullscreen)").click();

      // TODO this is not enough. should we wait for video track readyState?
      log("Waiting for video to be ready...");
      await page.waitForFunction(() => {
        const el = document.querySelector("video");
        return el && el.srcObject.id == "kvm" && el.srcObject.active;
      }, { timeout: 5000 });
      await sleep(1);

      log("Getting the video element...");
      const videoEl = await page.$("video");
      if (!videoEl) {
        throw new Error("video element not found");
      }

      if (options.text) {
        log("Typing...");
        await videoEl.focus();
        // TODO respect the keyboard layout.
        // XXX this will be convert to lowercase, and it will all go tru some
        //     kind of keyboard layout re-mapping, which will mess non-basic
        //     characters, so we need to find a way to make this work as
        //     expected.
        await videoEl.type(options.text, { delay: 100 });
      }

      log("Taking a screenshot of the video element...");
      await videoEl.screenshot({
        path: options.screenshotPath.replace(/\.([^.]+)$/, "-video.$1"),
      });

      // XXX does not return any data.
      // const base64Frame = await page.$eval("video", (video) => {
      //   const canvas = document.createElement("canvas");
      //   canvas.width = video.videoWidth; // intrinsic width
      //   canvas.height = video.videoHeight; // intrinsic height
      //   const ctx = canvas.getContext("2d");
      //   ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      //   return canvas.toDataURL("image/png"); // or "image/jpeg"
      // });
      // log(base64Frame);
    } finally {
      log("Taking a screenshot of the full page...");
      await page.screenshot({ path: options.screenshotPath, fullPage: true });
    }
  } finally {
    await browser.close();
  }
}

if (import.meta.main) {
  program
    .option("--debug", "run the browser in foreground", false)
    .option("--url", "JetKVM URL", "http://192.168.8.4")
    .option("--text <text>", "Text to type", "Hello, World!")
    .option("--viewport-size <size>", "browser viewport size", "1920x1080")
    .option(
      "--screenshot-path <path>",
      "screenshot output path",
      "screenshot.png",
    )
    .parse(Deno.args);

  await main(program.opts());
}
