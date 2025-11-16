// ftree.js

$(document).ready(docMain);

var conf = new Object();
conf["portsPerSwitch"] = 16;
// CHANGE: Default hosts, switches is now calculated
conf["hosts"] = 256;

var controlVisible = true;
// CHANGE: Reduce overall width (e.g., from 1000 to 800)
var SVG_W = 1000; // increased width so figure can spread out
var SVG_H = 1000; // increased height to reduce vertical clutter
var svg; // D3 SVG object
var data = { cables: [], core: [], edge: [], agg: [], host: [] };

function docMain() {
  formInit();
  // Initialize the SVG drawing area if it doesn't exist
  svg = d3
    .select("body")
    .append("svg")
    .attr("class", "main")
    .attr("width", SVG_W)
    .attr("height", SVG_H);

  updateStat();
  redraw();
  $(document).keypress(kpress);
}

// Handles 'h' key press to hide/show control panel
function kpress(e) {
  if (e.which == 104) {
    // 'h'
    if (controlVisible) {
      controlVisible = false;
      $("div.control").hide();
    } else {
      controlVisible = true;
      $("div.control").show();
    }
  }
}

// Compute depth and number of switches from hosts (N_host) and ports (k)
function computeSwitchesFromHosts(hosts, ports, maxDepth) {
  var k = Math.floor(ports / 2);
  if (k <= 0 || hosts <= 0) return { depth: 1, nswitch: 1, nhost: 2 * k };
  maxDepth = maxDepth || 10;

  // Total hosts for depth d in our drawing = 4 * k^d
  // Solve d = log(hosts / 4) / log(k)
  var d_float = Math.log(Math.max(1, hosts / 4)) / Math.log(k);
  var bestD = Math.max(1, Math.ceil(d_float));

  // Derived quantities (matching redraw())
  var line = Math.pow(k, bestD - 1);         // k^(d-1)
  var numPods = 2 * line;                    // pods drawn in redraw()
  var nhost = numPods * (2 * k);             // total hosts = numPods * hostsPerPod (2*k)
  var nswitch = (2 * bestD - 1) * line;      // (2d - 1) * k^(d-1)

  return { depth: bestD, nswitch: nswitch, nhost: nhost };
}

function formInit() {
  // CHANGE: Attach event listeners to both portsPerSwitch and hosts inputs
  $("form input[name='portsPerSwitch']").change(updateConf).keyup(updateConf);
  $("form input[name='hosts']").change(updateConf).keyup(updateConf);

  // Initial values
  $("form input[name='portsPerSwitch']").val(conf["portsPerSwitch"]);
  $("form input[name='hosts']").val(conf["hosts"]);
}

function updateConf() {
  // Update config from input fields
  var ports = parseInt($("form input[name='portsPerSwitch']").val());
  var hosts = parseInt($("form input[name='hosts']").val());

  conf["portsPerSwitch"] = isNaN(ports) ? 16 : ports;
  conf["hosts"] = isNaN(hosts) ? 256 : hosts;

  // Redraw and update stats
  updateStat();
  redraw();
}

function updateStat() {
  var ports = conf["portsPerSwitch"];
  var hosts = conf["hosts"];
  var k = Math.floor(ports / 2);

  if (k <= 0 || ports <= 0 || hosts <= 0) {
    // Setting all to N/A if inputs are invalid
    d3.select("#ntreedepth").html("N/A");
    d3.select("#nhost").html("N/A");
    d3.select("#nswitch").html("N/A");
    d3.select("#ncable").html("N/A");
    d3.select("#ntx").html("N/A");
    d3.select("#nswtx").html("N/A");
    return;
  }

  // CHANGE: Use new computation function
  var result = computeSwitchesFromHosts(hosts, ports, 10);
  var depth = result.depth;
  var nswitch = result.nswitch;
  var nhost = result.nhost; // The max hosts supported by this topology
  conf["depth"] = depth;
  conf["switches"] = nswitch;

  var line = Math.pow(k, depth - 1);

  // Calculate remaining statistics based on depth (d) and k
  var ncable = 2 * depth * k * line;
  var ntx = 2 * (2 * depth) * k * line;
  var nswtx = ntx - nhost;

  d3.select("#ntreedepth").html(formatNum(depth));
  d3.select("#nhost").html(formatNum(nhost));
  d3.select("#nswitch").html(formatNum(nswitch));
  d3.select("#ncable").html(formatNum(ncable));
  d3.select("#ntx").html(formatNum(ntx));
  d3.select("#nswtx").html(formatNum(nswtx));
}

// Formats numbers with commas
function formatNum(x) {
  if (isNaN(x) || !isFinite(x)) return "N/A";
  x = Math.floor(x).toString();
  var pattern = /(\d+)(\d{3})/g;
  while (pattern.test(x)) x = x.replace(pattern, "$1" + "," + "$2");
  return x;
}

// --- Visualization Logic for Reduced Representation ---

// ftree.js - Corrected redraw function (Final Centering)

function redraw() {
  if (svg) {
    svg.selectAll("*").remove();
  }

  var ports = conf["portsPerSwitch"];
  var k = Math.floor(ports / 2);
  var depth = conf["depth"];

  if (k <= 0 || depth <= 0) return;

  var line = Math.pow(k, depth - 1);
  var numPods = 2 * line;

  // --- Visualization Constants ---
  var PADDING_Y = 100; // increased top padding
  var TIER_SPACING = 180; // larger vertical gap between tiers
  var PADDING_X = 30;

  // Y-Coordinates for the four tiers
  var coreY = PADDING_Y;
  var aggY = coreY + TIER_SPACING;
  var edgeY = aggY + TIER_SPACING;
  var hostY = edgeY + TIER_SPACING;

  // Calculate center position
  var svgCenterX = SVG_W / 2;

  var nodes = [];

  // --- Step 1: Draw Core Switches (Tier 3) - SHOW ONLY 4 REPRESENTATIVE NODES ---
  // Instead of showing all k*k core switches, show only the first and last in each dimension
  var coreNodesToShow = [
    { index: 1, gridPos: { row: 0, col: 0 } },
    { index: k, gridPos: { row: 0, col: 1 } },
    { index: k * k - k + 1, gridPos: { row: 1, col: 0 } },
    { index: k * k, gridPos: { row: 1, col: 1 } },
  ];

  var coreSpacing = 120; // increased core horizontal spacing
  var coreGridWidth = coreSpacing;
  var coreStartX = svgCenterX - coreGridWidth / 2;

  coreNodesToShow.forEach(function (coreNode) {
    var coreX = coreStartX + coreNode.gridPos.col * coreSpacing;
    var coreRowY = coreY + coreNode.gridPos.row * coreSpacing;

    var dims = drawNode(coreX, coreRowY, "Tier 3", coreNode.index, k);
    nodes.push({
      id: "Tier3_" + coreNode.index,
      x: coreX,
      y: coreRowY,
      tier: "Tier 3",
      index: coreNode.index,
      podIndex: undefined,
      rectW: dims.rectW,
      totalH: dims.totalH,
    });
  });

  // Add ellipsis in the center of core switches
  svg
    .append("text")
    .attr("x", svgCenterX)
    .attr("y", coreY + coreSpacing / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .text("...");

  // --- Step 2: Draw Pods ---
  var podSpacing = 380; // give more horizontal room between first and last pod
  var leftPodX = svgCenterX - podSpacing / 2;
  var rightPodX = svgCenterX + podSpacing / 2;

  var podsToRender = [];
  if (numPods > 0) {
    podsToRender.push({ index: 0, x: leftPodX });
    if (numPods > 1) {
      drawEllipsis(svgCenterX, (aggY + edgeY) / 2 - TIER_SPACING / 4);
    }
    if (numPods > 1) {
      podsToRender.push({ index: numPods - 1, x: rightPodX });
    }
  }

  podsToRender.forEach(function (pod) {
    var podStartIndex = pod.index * k;

    // pass k into drawReducedTier so it can compute badges
    drawReducedTier(k, "Tier 2", pod.x, aggY, podStartIndex, nodes, k);
    drawReducedTier(k, "Tier 1", pod.x, edgeY, podStartIndex, nodes, k);

    var hostStartIndex = pod.index * 2 * k;
    drawReducedTier(2 * k, "Host", pod.x, hostY, hostStartIndex, nodes, k);
  });

  // --- Step 3: Draw Abstracted Cables ---
  drawCables(nodes, k, numPods, coreNodesToShow);
}

// Draws the first and last element of a switch tier or hosts
function drawReducedTier(
  totalCount,
  label,
  xAnchor,
  centerY,
  startIndex,
  nodes,
  k /* new param */
) {
  var elementsToRender = [];

  // Only render the first and last element of the group
  if (totalCount > 0) elementsToRender.push(0);
  if (totalCount > 1) elementsToRender.push(totalCount - 1);

  // scale horizontal spacing with k but ensure a reasonable minimum
  var element_spacing = Math.max(90, Math.floor(k * 12));
  var num_rendered = elementsToRender.length;

  // Adjust x position to center the group around xAnchor
  var x_offset = ((num_rendered - 1) * element_spacing) / 2;

  elementsToRender.forEach(function (idx, j) {
    var x = xAnchor + j * element_spacing - x_offset;
    var globalIndex = startIndex + idx + 1;
    var nodeID = label + "_" + globalIndex;

    // compute badge number: Tier 3 -> k, Tier 2/1 -> k/2, Host -> 1
    var badge = 1;
    if (label === "Tier 3") badge = k;
    else if (label === "Tier 2" || label === "Tier 1")
      badge = Math.floor(k / 2);
    else if (label === "Host") badge = 1;

    // drawNode returns dims; store them for cable anchoring
    var dims = drawNode(x, centerY, label, globalIndex, badge);

    nodes.push({
      id: nodeID,
      x: x,
      y: centerY,
      tier: label,
      index: globalIndex,
      podIndex: startIndex,
      rectW: dims.rectW,
      totalH: dims.totalH,
    });
  });

  // Render ellipsis if more than 2 elements
  if (totalCount > 2) {
    drawEllipsis(xAnchor, centerY);
  }
}

// drawNode now draws a rounded rectangle (main box) and a small badge-rect below it.
// It returns {rectW, rectH} so callers can use those values for cable anchoring.
function drawNode(x, y, label, index, badge) {
  // Prepare two-line label for Tier switches, single-line for Host
  var line1 = "";
  var line2 = "";

  if (label.indexOf("Tier") === 0) {
    // Split "Tier N" and "SW <index>" on separate lines
    var parts = label.split(" ");
    line1 = parts[0] + " " + parts[1]; // "Tier 1"
    line2 = "SW " + index; // "SW 1024"
  } else {
    // Host -> single line
    line1 = label + " " + index; // "Host 1"
    line2 = "";
  }

  // compute rect size based on the longer line
  var baseCharW = 6.0;
  var paddingX = 18;
  var maxLine = line2 ? Math.max(line1.length, line2.length) : line1.length;
  var rectW = Math.max(96, Math.ceil(maxLine * baseCharW) + paddingX); // larger min width
  var rectH = line2 ? 38 : 28; // taller if two-line label

  var rectX = x - rectW / 2;
  var rectY = y - rectH / 2;

  // draw main rect
  svg
    .append("rect")
    .attr("x", rectX)
    .attr("y", rectY)
    .attr("width", rectW)
    .attr("height", rectH)
    .attr("rx", 4)
    .attr("ry", 4)
    .attr("class", label.toLowerCase().replace(" ", ""))
    .style("fill", "#fff")
    .style("stroke", "#222")
    .style("stroke-width", 1);

  // draw text lines: center horizontally, arrange vertically
  if (line2) {
    // two lines: slightly above and below center
    svg
      .append("text")
      .attr("x", x)
      .attr("y", rectY + rectH / 2 - 6)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .text(line1);

    svg
      .append("text")
      .attr("x", x)
      .attr("y", rectY + rectH / 2 + 10)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .text(line2);
  } else {
    // single line
    svg
      .append("text")
      .attr("x", x)
      .attr("y", rectY + rectH / 2 + 4)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .text(line1);
  }

  // badge rectangle below main rect
  var badgeRectW = 22;
  var badgeRectH = 16;
  var gapBelow = 10;
  var badgeX = x - badgeRectW / 2;
  var badgeY = rectY + rectH + gapBelow;

  svg
    .append("rect")
    .attr("x", badgeX)
    .attr("y", badgeY)
    .attr("width", badgeRectW)
    .attr("height", badgeRectH)
    .attr("rx", 3)
    .attr("ry", 3)
    .attr("class", "badgeRect")
    .style("fill", "#fff")
    .style("stroke", "#444")
    .style("stroke-width", 1);

  svg
    .append("text")
    .attr("x", x)
    .attr("y", badgeY + badgeRectH / 2 + 4)
    .attr("text-anchor", "middle")
    .style("font-size", "10px")
    .style("font-weight", "400")
    .text(badge);

  // return dims
  return {
    rectW: rectW,
    rectH: rectH,
    badgeRectH: badgeRectH,
    totalH: rectH + gapBelow + badgeRectH,
  };
}

function drawEllipsis(x, y) {
  svg
    .append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .text("...");
}

// --- CORE CABLE LOGIC ---
function drawCables(nodes, k, numPods, coreNodesToShow) {
  function getRenderedNodes(tier, podIndex) {
    if (tier === "Tier 3") {
      return nodes.filter((n) => n.tier === tier);
    }
    return nodes.filter((n) => n.tier === tier && n.podIndex === podIndex);
  }

  var coreNodes = getRenderedNodes("Tier 3");
  var renderedPodIndices = [0];
  if (numPods > 1) {
    renderedPodIndices.push(numPods - 1);
  }

  // helper to compute anchor y (bottom of source rect / top of dest rect)
  // Use totalH so cables attach outside the badge area and avoid text
  function bottomY(n) {
    return n.y + n.totalH / 2 - 4; // nudge up slightly to avoid badge text
  }
  function topY(n) {
    return n.y - n.totalH / 2 + 4; // nudge down slightly so line doesn't cross label
  }

  // 1. Tier 3 to Tier 2 (use corner core nodes only)
  renderedPodIndices.forEach((podIndex) => {
    var startIndex = podIndex * k;
    var podAggNodes = getRenderedNodes("Tier 2", startIndex);

    if (coreNodes.length > 0 && podAggNodes.length > 0) {
      var cornerCores = coreNodes.filter(
        (c) =>
          c.index === 1 ||
          c.index === k ||
          c.index === k * k - k + 1 ||
          c.index === k * k
      );

      cornerCores.forEach((core) => {
        podAggNodes.forEach((agg) => {
          drawCable(core.x, bottomY(core), agg.x, topY(agg));
        });
      });
    }
  });

  // 2. Tier 2 to Tier 1
  renderedPodIndices.forEach((podIndex) => {
    var startIndex = podIndex * k;
    var podAggNodes = getRenderedNodes("Tier 2", startIndex);
    var podEdgeNodes = getRenderedNodes("Tier 1", startIndex);

    if (podAggNodes.length > 0 && podEdgeNodes.length > 0) {
      podAggNodes.forEach((agg) => {
        podEdgeNodes.forEach((edge) => {
          drawCable(agg.x, bottomY(agg), edge.x, topY(edge));
        });
      });
    }
  });

  // 3. Tier 1 to Hosts
  renderedPodIndices.forEach((podIndex) => {
    var startIndex = podIndex * k;
    var podEdgeNodes = getRenderedNodes("Tier 1", startIndex);
    var podHostNodes = getRenderedNodes("Host", podIndex * 2 * k);

    if (podEdgeNodes.length > 0 && podHostNodes.length > 0) {
      podEdgeNodes.forEach((edge) => {
        podHostNodes.forEach((host) => {
          drawCable(edge.x, bottomY(edge), host.x, topY(host));
        });
      });
    }
  });
}

function drawCable(x1, y1, x2, y2) {
  svg
    .append("line")
    .attr("x1", x1)
    .attr("y1", y1)
    .attr("x2", x2)
    .attr("y2", y2)
    .attr("class", "cable");
}
// END of ftree.js
