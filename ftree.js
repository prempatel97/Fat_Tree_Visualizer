$(document).ready(docMain);

var conf = new Object();
conf['portsPerSwitch'] = 16;
conf['switches'] = 24;

var controlVisible = true;

function docMain() {
    formInit();
    updateStat();
    redraw();
    $(document).keypress(kpress);
}

function kpress(e) {
    if (e.which == 104) { // 'h'
        if (controlVisible) {
            controlVisible = false;
            $("div.control").hide();
        } else {
            controlVisible = true;
            $("div.control").show();
        }
    }
}

// Compute depth from switches using fat-tree formula: nswitch = (2*d - 1) * k^(d-1)
function computeDepthFromSwitches(switches, k, maxDepth) {
    if (k <= 0 || switches <= 0) return 1;
    maxDepth = maxDepth || 10;
    var bestD = 1;
    var bestDiff = Infinity;
    
    for (var d = 1; d <= maxDepth; d++) {
        var line = Math.pow(k, d - 1);
        var nsw = (2 * d - 1) * line;
        var diff = Math.abs(nsw - switches);
        
        if (diff < bestDiff) {
            bestDiff = diff;
            bestD = d;
        }
        if (diff === 0) break;
        if (!isFinite(line) || line > 1e9) break;
    }
    return bestD;
}

function redraw() {
    var ports = parseInt(conf['portsPerSwitch'], 10) || 0;
    var switches = parseInt(conf['switches'], 10) || 0;
    
    if (ports <= 0 || switches <= 0) {
        d3.select("svg.main").remove();
        return;
    }
    
    var k = Math.floor(ports / 2);
    var depth = computeDepthFromSwitches(switches, k, 10);
    conf['depth'] = depth;
    
    // Call with original signature (depth, width)
    drawFatTree(depth, ports);
}

function drawFatTree(depth, width) {
    var k = Math.floor(width / 2);
    var padg = 13;
    var padi = 12;
    var hline = 70;
    var hhost = 50;

    var podw = 8;
    var podh = 8;
    var hostr = 2;

    var kexp = function (n) { return Math.pow(k, n); };

    d3.select("svg.main").remove();   
    if (k <= 0 || depth <= 0 || kexp(depth - 1) > 1500) {
        return;
    }

    var w = kexp(depth - 1) * padg + 200;
    var h = (2 * depth) * hline;

    var svg = d3.select("body").append("svg")
        .attr("width", w)
        .attr("height", h)
        .attr("class", "main")
        .append("g")
        .attr("transform", "translate(" + w/2 + "," + h/2 + ")");

    var linePositions = [];

    function podPositions(d) {
        var ret = [];

        var ngroup = kexp(d);
        var pergroup = kexp(depth - 1 - d);

        var wgroup = pergroup * padg;
        var wgroups = wgroup * (ngroup - 1);
        var offset = -wgroups/2;

        for (var i = 0; i < ngroup; i++) {
            var wpods = pergroup * padi;
            var goffset = wgroup * i - wpods/2;
            
            for (var j = 0; j < pergroup; j++) {
                ret.push(offset + goffset + padi * j);
            }
        }

        return ret;
    }

    for (var i = 0; i < depth; i++) {
        linePositions[i] = podPositions(i);
    }

    function drawPods(list, y) {
        for (var j = 0, n = list.length; j < n; j++) {
            svg.append("rect")
                .attr("class", "pod")
                .attr("width", podw)
                .attr("height", podh)
                .attr("x", list[j] - podw/2)
                .attr("y", y - podh/2);
        }
    }

    function drawHost(x, y, dy, dx) {
        svg.append("line")
            .attr("class", "cable")
            .attr("x1", x)
            .attr("y1", y)
            .attr("x2", x + dx)
            .attr("y2", y + dy);

        svg.append("circle")
            .attr("class", "host")
            .attr("cx", x + dx)
            .attr("cy", y + dy)
            .attr("r", hostr);
    }

    function drawHosts(list, y, direction) {
        for (var i = 0; i < list.length; i++) {
            if (k == 1) {
                drawHost(list[i], y, hhost * direction, 0);
            } else if (k == 2) {
                drawHost(list[i], y, hhost * direction, -2);
                drawHost(list[i], y, hhost * direction, +2);
            } else if (k == 3) {
                drawHost(list[i], y, hhost * direction, -4);
                drawHost(list[i], y, hhost * direction, 0);
                drawHost(list[i], y, hhost * direction, +4);
            } else {
                drawHost(list[i], y, hhost * direction, -4);
                drawHost(list[i], y, hhost * direction, 0);
                drawHost(list[i], y, hhost * direction, +4);
            }
        }
    }
    
    function linePods(d, list1, list2, y1, y2) {
        var pergroup = kexp(depth - 1 - d);
        var ngroup = kexp(d);

        var perbundle = pergroup / k;
        
        for (var i = 0; i < ngroup; i++) {
            var offset = pergroup * i;
            for (var j = 0; j < k; j++) {
                var boffset = perbundle * j;
                for (var t = 0; t < perbundle; t++) {
                    var ichild = offset + boffset + t;
                    for (var d2 = 0; d2 < k; d2++) {
                        var ifather = offset + perbundle * d2 + t;
                        svg.append("line")
                            .attr("class", "cable")
                            .attr("x1", list1[ifather])
                            .attr("y1", y1)
                            .attr("x2", list2[ichild])
                            .attr("y2", y2);
                    }
                }
            }
        }
    }

    for (var i = 0; i < depth - 1; i++) {
        linePods(i, linePositions[i], linePositions[i + 1], i * hline, (i + 1) * hline);
        linePods(i, linePositions[i], linePositions[i + 1], -i * hline, -(i + 1) * hline);
    }

    drawHosts(linePositions[depth - 1], (depth - 1) * hline, 1);
    drawHosts(linePositions[depth - 1], -(depth - 1) * hline, -1);

    for (var i = 0; i < depth; i++) {
        if (i == 0) {
            drawPods(linePositions[0], 0);
        } else {
            drawPods(linePositions[i], i * hline);
            drawPods(linePositions[i], -i * hline);
        }
    }
}

function updateStat() {
    var ports = parseInt(conf['portsPerSwitch'], 10) || 0;
    var switches = parseInt(conf['switches'], 10) || 0;
    
    if (switches === 0 || ports === 0) {
        d3.select("#ntreedepth").html("&nbsp;");
        d3.select("#nhost").html("&nbsp;");
        d3.select("#ncable").html("&nbsp;");
        d3.select("#ntx").html("&nbsp;");
        d3.select("#nswtx").html("&nbsp;");
        return;
    }
    
    var k = Math.floor(ports / 2);
    var depth = computeDepthFromSwitches(switches, k, 10);
    conf['depth'] = depth;
    
    var line = Math.pow(k, depth - 1);
    var nhost = 2 * line * k;
    var nswitch = (2 * depth - 1) * line;
    var ncable = (2 * depth) * k * line;
    var ntx = 2 * (2 * depth) * k * line;
    var nswtx = ntx - nhost;

    d3.select("#ntreedepth").html(formatNum(depth));
    d3.select("#nhost").html(formatNum(nhost));
    d3.select("#ncable").html(formatNum(ncable));
    d3.select("#ntx").html(formatNum(ntx));
    d3.select("#nswtx").html(formatNum(nswtx));
}

function formatNum(x) {
    if (isNaN(x) || !isFinite(x)) return "N/A";
    x = Math.floor(x).toString();
    var pattern = /(-?\d+)(\d{3})/;
    while (pattern.test(x))
        x = x.replace(pattern, "$1,$2");
    return x;
}

function formInit() {
    var form = d3.select("form");

    function confInt() { 
        var val = parseInt(this.value, 10);
        if (!isNaN(val) && val > 0) {
            conf[this.name] = val;
        }
        updateStat();
        redraw();
    }

    function hook(name, func) {
        var fields = form.selectAll("[name=" + name + "]");
        fields.on("change", func);
        fields.each(func);
    }

    hook("switches", confInt);
    hook("portsPerSwitch", confInt);
}

