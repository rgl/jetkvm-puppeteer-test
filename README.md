# About

Control a [JetKVM](https://jetkvm.com) managed device with [Puppeteer](https://pptr.dev).

# TODO

* somehow correctly type text into the managed device.
  * see https://github.com/jetkvm/kvm/issues/787
  * see https://github.com/jetkvm/kvm/issues/649

# Usage

Ensure JetKVM is available on your local network, e.g., at http://192.168.8.4.

Install [Deno](https://deno.com).

Connect to JetKVM and type some text into the managed device keyboard:

```bash
deno run -A main.ts \
    --url http://192.168.8.4 \
    --text 'Aa|!"#$%&/()=?«»<>,;.:-_\zZ'
```
