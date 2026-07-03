# Safari

Safari loads Web Extensions through a native app wrapper. Convert this MV3
extension with Apple's tool once `theme.css` is generated (see
[`../shared/README.md`](../shared/README.md)):

```sh
xcrun safari-web-extension-converter .
```

Then build and run the generated Xcode project. The `manifest.json` and
`content.js` here are shared with the other browsers.
