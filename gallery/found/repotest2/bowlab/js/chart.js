/* ============================================================================
   bowlab / chart.js — canvas charts: force-draw curve (with the stored-energy
   area, peak marker, live draw marker), cam-over lever arm and arrow speed.
   ========================================================================== */
(function (root) {
  'use strict';

  function Chart(canvas, opts) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.series = [];
    this.marker = null;
    this.resize();
  }
  Chart.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    this.w = Math.max(60, r.width); this.h = Math.max(40, r.height);
    this.c.width = this.w * this.dpr; this.c.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };
  Chart.prototype.setSeries = function (series) { this.series = series || []; this.draw(); };
  Chart.prototype.setMarker = function (m) { this.marker = m; this.draw(); };

  Chart.prototype.draw = function () {
    var ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    var padL = 26, padR = 8, padT = 8, padB = 16;
    var iw = w - padL - padR, ih = h - padT - padB;
    if (iw < 10 || ih < 10) return;
    var xMax = 0, yMax = 0;
    this.series.forEach(function (s) {
      s.data.forEach(function (p) { xMax = Math.max(xMax, p[0]); yMax = Math.max(yMax, p[1]); });
    });
    xMax = xMax || 1; yMax = yMax * 1.08 || 1;
    var X = function (v) { return padL + (v / xMax) * iw; };
    var Y = function (v) { return padT + ih - (v / yMax) * ih; };

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i <= 4; i++) { var y = padT + (i / 4) * ih; ctx.moveTo(padL, y); ctx.lineTo(padL + iw, y); }
    for (var j = 0; j <= 4; j++) { var x = padL + (j / 4) * iw; ctx.moveTo(x, padT); ctx.lineTo(x, padT + ih); }
    ctx.stroke();
    // axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = '9px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var k = 0; k <= 4; k++) ctx.fillText((yMax * (1 - k / 4)).toFixed(0), padL - 4, padT + (k / 4) * ih);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var m = 0; m <= 4; m++) ctx.fillText((xMax * (m / 4)).toFixed(1), padL + (m / 4) * iw, padT + ih + 3);
    ctx.textAlign = 'left';
    ctx.fillText(this.opts.yLabel || '', 2, 0);
    ctx.textAlign = 'right';
    ctx.fillText(this.opts.xLabel || '', w - 2, h - 10);

    this.series.forEach(function (s) {
      // filled area?
      if (s.fill && s.data.length > 1) {
        ctx.beginPath(); ctx.moveTo(X(s.data[0][0]), Y(0));
        s.data.forEach(function (p) { ctx.lineTo(X(p[0]), Y(p[1])); });
        ctx.lineTo(X(s.data[s.data.length - 1][0]), Y(0)); ctx.closePath();
        var g = ctx.createLinearGradient(0, padT, 0, padT + ih);
        g.addColorStop(0, s.fill); g.addColorStop(1, 'rgba(255,122,26,0.02)');
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.beginPath();
      s.data.forEach(function (p, i) { i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])); });
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.6;
      ctx.setLineDash(s.dash || []);
      ctx.stroke(); ctx.setLineDash([]);
    });

    if (this.marker != null) {
      var mx = X(this.marker.x);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, padT + ih); ctx.stroke();
      ctx.setLineDash([]);
      if (this.marker.y != null) {
        ctx.fillStyle = '#ffb066';
        ctx.beginPath(); ctx.arc(mx, Y(this.marker.y), 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  root.BowChart = Chart;
})(window);
