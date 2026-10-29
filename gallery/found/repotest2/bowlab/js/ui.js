/* ============================================================================
   bowlab / ui.js — control panel + telemetry.  Panels are generated from a
   schema so adding a parameter is a one-line change.
   ========================================================================== */
(function (root) {
  'use strict';

  var fmt = function (v, d) { return (v === null || v === undefined || isNaN(v)) ? '--' : v.toFixed(d === undefined ? 1 : d); };

  var SCHEMA = {
    compound: [
      { group: 'Draw force profile' },
      { id: 'peakWeight', label: 'Peak draw weight', unit: 'lb', min: 25, max: 95, step: 1, dec: 0 },
      { id: 'letOff', label: 'Let-off (target)', unit: '%', min: 40, max: 92, step: 1, dec: 0, scale: 100, inv: 0.01 },
      { id: 'peakAt', label: 'Peak position', unit: '% stroke', min: 15, max: 75, step: 1, dec: 0, scale: 100, inv: 0.01 },
      { group: 'Bow geometry' },
      { id: 'ata', label: 'Axle to axle at brace', unit: 'in', min: 26, max: 38, step: 0.25, dec: 2 },
      { id: 'brace', label: 'Brace height', unit: 'in', min: 5, max: 8.5, step: 0.05, dec: 2 },
      { id: 'drawLength', label: 'Draw length (AMO)', unit: 'in', min: 24, max: 32, step: 0.25, dec: 2 },
      { id: 'ataFull', label: 'Axle to axle at full draw', unit: 'in', min: 24, max: 38, step: 0.25, dec: 2 },
      { id: 'stringGrooveR', label: 'String groove radius', unit: 'in', min: 1.0, max: 2.0, step: 0.05, dec: 2 },
      { id: 'camArmHi', label: 'Cable lever arm at brace', unit: 'in', min: 0.4, max: 1.4, step: 0.05, dec: 2 },
      { group: 'Arrow + string mass' },
      { id: 'arrowMass', label: 'Arrow mass', unit: 'grain', min: 220, max: 750, step: 5, dec: 0 },
      { id: 'virtualMass', label: 'Bow virtual mass (string+cams+limbs)', unit: 'grain', min: 15, max: 160, step: 1, dec: 0 }
    ],
    recurve: [
      { group: 'Bow' },
      { id: 'drawWeight', label: 'Draw weight at full draw', unit: 'lb', min: 15, max: 65, step: 1, dec: 0 },
      { id: 'tipToTip', label: 'Tip to tip (strung)', unit: 'in', min: 48, max: 72, step: 0.5, dec: 1 },
      { id: 'brace', label: 'Brace height', unit: 'in', min: 5, max: 10, step: 0.1, dec: 1 },
      { id: 'drawLength', label: 'Draw length (AMO)', unit: 'in', min: 24, max: 32, step: 0.25, dec: 2 },
      { id: 'tipRadius', label: 'Tip hook radius', unit: 'in', min: 0.5, max: 4, step: 0.1, dec: 1 },
      { id: 'braceTension', label: 'String tension at brace', unit: 'lb', min: 10, max: 60, step: 1, dec: 0 },
      { group: 'Arrow' },
      { id: 'arrowMass', label: 'Arrow mass', unit: 'grain', min: 200, max: 800, step: 5, dec: 0 },
      { id: 'virtualMass', label: 'Bow virtual mass', unit: 'grain', min: 15, max: 160, step: 1, dec: 0 }
    ]
  };

  function buildControls(host, kind, params, onChange) {
    host.innerHTML = '';
    var rows = {};
    SCHEMA[kind].forEach(function (s) {
      if (s.group) {
        var h = document.createElement('div');
        h.className = 'groupTitle';
        h.textContent = s.group;
        host.appendChild(h);
        return;
      }
      var row = document.createElement('div');
      row.className = 'ctl';
      var lab = document.createElement('label');
      lab.innerHTML = '<span>' + s.label + '</span>';
      var val = document.createElement('b');
      lab.appendChild(val);
      var inp = document.createElement('input');
      inp.type = 'range';
      inp.min = s.min; inp.max = s.max; inp.step = s.step;
      var raw = params[s.id];
      inp.value = s.scale ? raw * s.scale : raw;
      row.appendChild(lab); row.appendChild(inp);
      host.appendChild(row);
      var disp = function () {
        var v = parseFloat(inp.value);
        val.textContent = fmt(s.scale ? v : v, s.dec) + ' ' + s.unit;
      };
      disp();
      inp.addEventListener('input', function () {
        var v = parseFloat(inp.value);
        disp();
        onChange(s.id, s.inv ? v * s.inv : v, true);
      });
      inp.addEventListener('change', function () {
        var v = parseFloat(inp.value);
        onChange(s.id, s.inv ? v * s.inv : v, false);
      });
      rows[s.id] = { input: inp, disp: disp, schema: s };
    });
    return rows;
  }

  function buildPlayback(host, cb) {
    host.innerHTML = '';
    function btn(label, cls, fn) {
      var b = document.createElement('button');
      b.className = 'btn ' + (cls || '');
      b.textContent = label;
      b.addEventListener('click', fn);
      host.appendChild(b);
      return b;
    }
    var bDraw = btn('Draw', 'primary', function () { cb('draw'); });
    var bHold = btn('Hold', '', function () { cb('hold'); });
    var bFire = btn('Release', 'fire', function () { cb('release'); });
    var bReset = btn('Reset', '', function () { cb('reset'); });
    var bAuto = btn('Auto cycle', '', function () { cb('auto'); });
    var bWire = btn('X-ray', '', function () { cb('wire'); });
    var bArms = btn('Force vectors', '', function () { cb('arms'); });
    var bExp = btn('Explode', '', function () { cb('explode'); });
    return { bDraw: bDraw, bHold: bHold, bFire: bFire, bReset: bReset, bAuto: bAuto, bWire: bWire, bArms: bArms, bExp: bExp };
  }

  function kv(label, value) {
    var d = document.createElement('div');
    d.className = 'kv';
    d.innerHTML = '<span>' + label + '</span><b>' + value + '</b>';
    return d;
  }

  function buildReadout(host) {
    host.innerHTML = '';
    var sec = function (title) {
      var s = document.createElement('div');
      s.className = 'groupTitle';
      s.textContent = title;
      host.appendChild(s);
    };
    sec('Live');
    var out = {};
    ['Draw force', 'String tension', 'Cable tension', 'Cam rotation', 'Limb tip travel', 'Cable lever ratio'].forEach(function (k) {
      out[k] = kv(k, '--'); host.appendChild(out[k]);
    });
    sec('Performance');
    ['Stored energy', 'Arrow speed', 'Kinetic energy', 'Efficiency', 'IBO-style spec', 'Peak / holding force', 'Let-off (actual)'].forEach(function (k) {
      out[k] = kv(k, '--'); host.appendChild(out[k]);
    });
    sec('Design derived');
    ['Limb tip rate', 'Cable hub radius', 'String paid out', 'ATA at full draw', 'Power stroke', 'Release time'].forEach(function (k) {
      out[k] = kv(k, '--'); host.appendChild(out[k]);
    });
    return out;
  }

  root.BowUI = {
    controls: buildControls, playback: buildPlayback, readout: buildReadout, kv: kv, fmt: fmt, SCHEMA: SCHEMA
  };
})(window);
