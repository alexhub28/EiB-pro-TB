
const titleLookup = {
    de: "Einsatzbetriebe und Einsatzplätze pro Tätigkeitsbereich",
    fr: "Établissements et places d'affectation par domaine d'activité",
    it: "Istituti e posti d'impiego per ambito di attività"
}

function setup() {

  let params = getURLParams();
  console.log(params);

  let title = titleLookup[params.lang];
  console.log("title:",title);

  d3.select("#titleContainer").text(title);
  noCanvas();
  drawChart(params.lang);
  window.addEventListener("resize", drawChart);
}

// 🎨 Familles de teintes officielles ZIVI : jaune (accent5) pour
// Einsatzbetriebe, lila (accent3) pour Einsatzplätze. Le petrol est
// désormais réservé aux jours de service (DT) dans tous les graphiques.
// Chaque barre est colorée selon un dégradé d'intensité propre à sa
// série (plus la valeur est élevée, plus la teinte est soutenue).
const BASE_BETRIEBE = "#FCEB30";  // accent5 — jaune (intensité max)
const LIGHT_BETRIEBE = "#FEFACB"; // jaune très clair (intensité min)
const BASE_PLAETZE = "#A3A8CA";   // accent3 — lila (intensité max)
const LIGHT_PLAETZE = "#EBECF3";  // lila très clair (intensité min)

// --- Formatage suisse : 8'344 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function drawChart(lang) {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  const width = containerWidth;
  const isMobile = width < 600;

  let filename = "data_" + lang + ".csv";
  console.log("filename",filename);
 // d3.csv("ABI_Einsatzbetriebe_und_Einsatzplaetze_nach_TB_2025.csv").then(raw => {
  d3.csv(filename).then(raw => {

    const data = raw.map(d => ({
      label: d["Tätigkeit"],
      betriebe: +d["Einsatzbetriebe"],
      plaetze: +d["Einsatzplätze"]
    }));

    // Ordre décroissant par nombre de places d'affectation (Einsatzplätze)
    data.sort((a, b) => b.plaetze - a.plaetze);

    const rowHeight = 42;
    const legendHeight = 46; // ⭐ légende sur une seule ligne par item (embed compact)
    const margin = {
      top: legendHeight,
      right: isMobile ? 55 : 78,
      bottom: 16,
      left: isMobile ? 135 : 270
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = data.length * rowHeight;
    const height = margin.top + innerHeight + margin.bottom;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // --- Légende (puces carrées, trilingue) — en haut, avant le graphique ---
    const legend = svg.append("g")
      .attr("transform", `translate(${margin.left}, 6)`);

    const legendItems = [
      { color: BASE_BETRIEBE, text: "Einsatzbetriebe / Établissements d’affectation / Istituti d’impiego" },
      { color: BASE_PLAETZE, text: "Einsatzplätze / Places d’affectation / Posti d’impiego" }
    ];

    // Texte réparti sur 3 lignes (une par langue) : évite tout débordement
    // horizontal sur petit écran, contrairement à une ligne trilingue unique.
    legendItems.forEach((item, i) => {
      const row = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
      row.append("rect")
        .attr("width", 9)
        .attr("height", 9)
        .attr("y", 4)
        .attr("fill", item.color);

      row.append("text")
        .attr("x", 16)
        .attr("y", 10)
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "9px" : "10px")
        .style("fill", "#111")
        .text(item.text);
    });

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const maxBetriebe = d3.max(data, d => d.betriebe);
    const maxPlaetze = d3.max(data, d => d.plaetze);
    const maxVal = Math.max(maxBetriebe, maxPlaetze);

    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.12])
      .range([0, innerWidth]);

    // Échelle de couleur en racine carrée : évite qu'une seule grosse valeur
    // écrase tout le dégradé (sinon presque toutes les barres seraient pâles).
    const colorBetriebe = d3.scaleSqrt().domain([0, maxBetriebe]).range([0, 1]);
    const colorPlaetze = d3.scaleSqrt().domain([0, maxPlaetze]).range([0, 1]);

    const y0 = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, innerHeight])
      .paddingInner(0.45)
      .paddingOuter(0.15);

    const y1 = d3.scaleBand()
      .domain(["betriebe", "plaetze"])
      .range([0, y0.bandwidth()])
      .paddingInner(0.08);

    const series = [
      { key: "betriebe", light: LIGHT_BETRIEBE, base: BASE_BETRIEBE, scale: colorBetriebe },
      { key: "plaetze", light: LIGHT_PLAETZE, base: BASE_PLAETZE, scale: colorPlaetze }
    ];

    // Largeur plancher : une valeur non nulle reste toujours visible,
    // même minuscule à cette échelle (ex. Katastrophen : 11 / 48).
    const MIN_BAR_WIDTH = 2;
    const barWidth = (val) => val > 0 ? Math.max(x(val), MIN_BAR_WIDTH) : 0;

    // --- Barres avec animation d'apparition + dégradé d'intensité ---
    series.forEach((s, si) => {
      g.selectAll(`rect.bar-${s.key}`)
        .data(data)
        .enter()
        .append("rect")
        .attr("class", `bar bar-${s.key}`)
        .attr("y", d => y0(d.label) + y1(s.key))
        .attr("height", y1.bandwidth())
        .attr("width", 0)
        .attr("fill", d => d3.interpolate(s.light, s.base)(s.scale(d[s.key])))
        .transition()
        .delay((d, i) => i * 90 + si * 45)
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr("width", d => barWidth(d[s.key]));

      // --- Étiquette de valeur, avec compteur animé ---
      g.selectAll(`text.value-${s.key}`)
        .data(data)
        .enter()
        .append("text")
        .attr("class", `value value-${s.key}`)
        .attr("x", 6)
        .attr("y", d => y0(d.label) + y1(s.key) + y1.bandwidth() / 2)
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "9.5px" : "10.5px")
        .style("font-weight", "bold")
        .style("fill", "#111")
        .text("0")
        .transition()
        .delay((d, i) => i * 90 + si * 45)
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr("x", d => barWidth(d[s.key]) + 6)
        .textTween(function (d) {
          const iVal = d3.interpolateNumber(0, d[s.key]);
          return t => formatSwiss(iVal(t));
        });
    });

    // --- Labels trilingues à gauche, centrés sur la paire de barres ---
    const rowLabels = g.selectAll("text.label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", -10)
      .attr("y", d => y0(d.label) + y0.bandwidth() / 2)
      .attr("text-anchor", "end")
      .style("font-family", "Arial")
      .style("font-size", isMobile ? "9.5px" : "10.5px")
      .style("font-weight", "normal")
      .style("fill", "#333");

    rowLabels.each(function (d) {
      const parts = d.label.split(" / ");
      const group = d3.select(this);

      group.append("tspan").attr("x", -10).attr("dy", "-0.95em").text(parts[0]);
      group.append("tspan").attr("x", -10).attr("dy", "1.05em").text(parts[1]);
      group.append("tspan").attr("x", -10).attr("dy", "1.05em").text(parts[2]);
    });

    // --- Survol par ligne : met en évidence une catégorie ---
    function highlight(label) {
      g.selectAll(".bar, .value")
        .transition().duration(150)
        .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3);

      // ⭐ Label survolé : noir plus franc + gras (pas d'agrandissement,
      // pour ne pas risquer de chevaucher les lignes voisines).
      g.selectAll(".label")
        .transition().duration(150)
        .style("opacity", d => (label === null || d.label === label) ? 1 : 0.3)
        .style("font-weight", d => (label !== null && d.label === label) ? "bold" : "normal")
        .style("fill", d => (label !== null && d.label === label) ? "#000" : "#333");
    }

    g.selectAll("rect.hit")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "hit")
      .attr("x", -margin.left)
      .attr("y", d => y0(d.label) - (y0.step() - y0.bandwidth()) / 2)
      .attr("width", innerWidth + margin.left + margin.right)
      .attr("height", y0.step())
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => highlight(d.label))
      .on("mouseout", () => highlight(null));
  });
}




