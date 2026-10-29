EIFFEL TOWER PROJECT — DOWNLOADED DEPENDENCIES (KEEP ON DISK)
=============================================================
These files were downloaded while generating `eiffel-tower.html`.
They are REQUIRED at runtime (the page loads them through the importmap in
`eiffel-tower.html`) and are deliberately kept — do not delete this folder.

three.js r169 (MIT), from unpkg
-------------------------------
vendor\three.module.js                                 1,304,820 B
  https://unpkg.com/three@0.169.0/build/three.module.js

vendor\addons\controls\OrbitControls.js                   32,134 B
  https://unpkg.com/three@0.169.0/examples/jsm/controls/OrbitControls.js
vendor\addons\environments\RoomEnvironment.js              3,606 B
  https://unpkg.com/three@0.169.0/examples/jsm/environments/RoomEnvironment.js
vendor\addons\postprocessing\EffectComposer.js             4,651 B
  https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/EffectComposer.js
vendor\addons\postprocessing\RenderPass.js                 1,941 B
  https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/RenderPass.js
vendor\addons\postprocessing\ShaderPass.js                 1,576 B
  https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/ShaderPass.js
vendor\addons\postprocessing\Pass.js                       1,706 B
  https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/Pass.js
vendor\addons\postprocessing\MaskPass.js                   2,231 B
  https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/MaskPass.js
vendor\addons\postprocessing\UnrealBloomPass.js           12,410 B
  https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/UnrealBloomPass.js
vendor\addons\postprocessing\OutputPass.js                 2,524 B
  https://unpkg.com/three@0.169.0/examples/jsm/postprocessing/OutputPass.js
vendor\addons\shaders\CopyShader.js                          571 B
  https://unpkg.com/three@0.169.0/examples/jsm/shaders/CopyShader.js
vendor\addons\shaders\LuminosityHighPassShader.js          1,147 B
  https://unpkg.com/three@0.169.0/examples/jsm/shaders/LuminosityHighPassShader.js
vendor\addons\shaders\OutputShader.js                      1,490 B
  https://unpkg.com/three@0.169.0/examples/jsm/shaders/OutputShader.js

Relative import paths inside the addons (`./Pass.js`, `../shaders/...`) are
preserved, so the folder layout must stay exactly as it is.

Verification toolchain (also kept)
----------------------------------
_tool\node_modules\puppeteer-core\   (npm install, headless Chrome driver)
_tool\package.json, _tool\package-lock.json
_tool\qa.mjs              pixel QA of a screenshot (silhouette/band heuristics)
_tool\_verify.mjs         single-view EIFFEL-OK/EIFFEL-ERROR capture
_tool\_verify_all.mjs     multi-view (hero/base/top/night) capture driver

Runtime notes
-------------
* ES modules do not load over `file://` — serve the folder:
      node serve.mjs
  then open  http://127.0.0.1:8080/eiffel-tower.html
* No runtime internet access is needed; everything resolves to ./vendor.
