import * as GlobeGL from 'https://cdn.jsdelivr.net/npm/globe.gl@2.32.1';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm';

// Fetch the country data
const countries = await fetch('public/data/ne_110m_admin_0_countries.json').then(res => res.json());
const dataset = await d3.csv('public/data/AgeDataset-V3-wo-unknown.csv', function(d) {
    return {
        ...d,
        'lat': parseFloat(d['lat']),
        'lng': parseFloat(d['lng']),
        'Age of death': parseInt(d['Age of death']),
        'Birth year': parseInt(d['Birth year']),
        'Death year': parseInt(d['Death year']),
    };
})
const occupationCategories = ['Art', 'Politics', 'Sports', 'Science', 'Business', 'Social'];
const deathCategories = ['Natural Causes', 'Unintentional Causes', 'Suicide and Self-Inflicted', 'Homicide and Violence'];

const GREEN = "#008000"
const RED = "#FF6347"
const BLUE = "#6495ED"
const YELLOW = "#FFFFE0"
const ORANGE = "#FFA07A"
const PURPLE = "#BA55D3"
const GRAY = "#A9A9A9"
const PINK = "#FFB6C1"
const CYAN = "#00CED1"
const BROWN = "#A0522D"
const GOLD = "gold"
const MAGENTA = "#FF99FF"
const WHITE = "#FFFFFF"

const occupationColors = {
    'Art': PURPLE,
    'Politics': BLUE,
    'Sports': ORANGE,
    'Science': CYAN,
    'Business': BROWN,
    'Social': MAGENTA,
}
const lifeColorScale = d3.scaleLog().domain([1, 100]).range(['green', WHITE]);
const countColorScale = d3.scaleLinear().domain([1, 100]).range([WHITE, 'green']);
const deathColorScale = d3.scaleLinear().domain([1, 120]).range([WHITE, 'red']);

// filters
let selectedCountry = null;
let selectedSex = null;
let selectedOccupation = null;
let selectedYears = [0, 500];

// Create the Globe instance
const globe = Globe({animateIn:false})(document.getElementById('map'))
    .globeImageUrl('public/resources/earth-blue-marble-5.jpg')
    .bumpImageUrl('public/resources/earth-topology.png')
    .showGraticules(true)
    .backgroundColor('#FFFFFF')
    .showAtmosphere(true)
    .polygonAltitude(0.06)
    .atmosphereAltitude(0.15)
    .onGlobeReady(contentLoaded)

globe.pointOfView({
    lat: 31.53053017619426,
    lng: 26.654858158911203,
    altitude: 2.499999999999998
}, 1000);

// Add labels to the globe
globe.labelsData(countries.features)
    .labelAltitude(0.02)
    .labelSize(d => {
        const newMin = 0.3, newMax = 3;
        return newMin + (Math.sqrt(d.properties.area) * (newMax - newMin)) / 60;
    })
    .labelLat(d => d.properties.lat)
    .labelLng(d => d.properties.lng)
    .labelText(d => d.properties.name)
    .labelColor('white')
    .labelIncludeDot(false)

// globe.controls().autoRotate = true;
// globe.controls().autoRotateSpeed = 3;


const w = window.innerWidth;
const shiftFactor = 0.2;
const shiftAmount = shiftFactor * w;

const globeContainer = document.getElementById('map');
globeContainer.style.marginLeft = `-${shiftAmount}px`;
globeContainer.style.width = `${w + shiftAmount}px`;


function updateGlobe(data) {
    const countryArea = {};
    countries.features.forEach(feature => {
        const countryName = feature.properties.name;
        countryArea[countryName] = feature.properties.area;
    });

    // Count the number of records for each country
    const countryCounts = {};
    data.forEach(row => {
        const countryName = row['Country'];
        if (!countryCounts[countryName]) {
            countryCounts[countryName] = 1;
        } else {
            countryCounts[countryName]++;
        }
    });

    // Convert to an array, sort by count, and then reduce to get ranks
    const countryRanks = Object
        .entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .reduce((acc, [countryName], index) => {
            acc[countryName] = index + 1;
            return acc;
        }, {});

    const topCountries = Object.entries(countryRanks)
                               .sort((a, b) => a[1] - b[1])
                               .slice(0, 10);

    // Get the div where we want to display the top countries
    const topCountriesDiv = document.getElementById('topCountries');

    // Clear existing content
    topCountriesDiv.innerHTML = '';

    // Create a list element for each top country
    topCountries.forEach(([country, rank]) => {
        const countryElement = document.createElement('div');
        countryElement.textContent = `${rank}. ${country} (${countryCounts[country]} records)`;
        topCountriesDiv.appendChild(countryElement);
    });

    // Define the hover color
    const polyCapHoverColor = 'lightgray';
    const polySideColor = 'black';

    function getCapColor(d) {
        const countryName = d.properties.name;
        if (countryName === selectedCountry) {
            return polyCapHoverColor
        } else {
            const rank = countryRanks[countryName];
            return rank !== undefined ? lifeColorScale(rank) : 'gray';
        }
    }

    function updateGlobePoints(data) {
        globe.pointsData(data)
            .pointAltitude(0.013)
            .pointRadius(d => 0.08 + (countryArea[d.Country] * (0.4 - 0.03)) / 3000)
            .pointColor(d => occupationColors[d['Occupation category']])
            .pointLabel(d => get_tooltip_html(d))
            .onPointClick(d => {
                // Redirect to the Wikipedia page based on the QID
                window.open(`https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/${d.Id}`, '_blank');
            })
            .onPointHover(hoverD => {
                globe
                  .pointColor(d => d === hoverD ? GOLD : occupationColors[d['Occupation category']])
            })
            .pointsTransitionDuration(100)
    }

    // Add the country borders
    globe.polygonsData(countries.features)
        .polygonAltitude(0)
        .polygonSideColor(() => polySideColor)
        .polygonCapColor(d => getCapColor(d))
        .polygonAltitude(0.01)
        .polygonStrokeColor(() => '#111')
        .onPolygonHover(hoverD => {
            globe
                .polygonAltitude(d => {
                    if (d === selectedCountry) {
                        return 0.01
                    } else if (d === hoverD) {
                        return 0.011
                    }
                    return 0.01
                })
                .polygonCapColor(d => {
                    if (d === selectedCountry) {
                        return polyCapHoverColor
                    } else if (d === hoverD) {
                        return GOLD
                    }
                    return getCapColor(d)
                })
                .polygonStrokeColor(d => {
                    if (d === selectedCountry) {
                        return 'black'
                    } else if (d === hoverD) {
                        return GOLD
                    }
                    return '#111'

                })
        })
        .onPolygonClick((clickD) => {
            const zoomThreshold = 1.5;
            const currentView = globe.pointOfView();

            if (clickD.properties.name === selectedCountry && currentView.altitude < zoomThreshold) {
                // If the camera is already close to the same country (zoomed in), zoom out
                globe.pointOfView({
                    lat: currentView.lat,
                    lng: currentView.lng,
                    altitude: zoomThreshold + 0.5
                }, 1000);
                selectedCountry = null;
            } else {
                // If it's a different country or the camera is far, move the camera to the new country
                globe.pointOfView({
                    lat: clickD.properties.lat,
                    lng: clickD.properties.lng,
                    altitude: 0.2 + (Math.sqrt(clickD.properties.area) * (1.0 - 0.2)) / 60
                }, 1000);
                selectedCountry = clickD.properties.name;
            }
            update()
        })
        .polygonsTransitionDuration(0);
    if (selectedCountry != null) {
        updateGlobePoints(data)
    } else { globe.pointsData([]) }
}


function initializeSlider() {
    let yearSlider = document.getElementById('yearSlider');
    noUiSlider.create(yearSlider, {
        start: selectedYears,
        connect: true,
        behaviour: 'drag-smooth-steps',
        step: 1,
        range: {
            'min': 0,
            'max': 2024
        },
        tooltips: [
            {
                to: function (value) {
                    return Math.round(value);
                }
            },
            {
                to: function (value) {
                    return Math.round(value);
                }
            }
        ],
        pips: {
            mode: 'values',
            values: [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2024],
            density: 1
        }
    });
    mergeTooltips(yearSlider, 3, "-")

    yearSlider.noUiSlider.on('update', function (values, handle) {
        selectedYears = values;
        update();
    });

    let intervalId;
    let isAutoScrolling = false;
    let button = document.getElementById('autoScrollButton');
    function autoScrollSlider() {
        let values = yearSlider.noUiSlider.get();

        let step = 1;
        let newFromYear = parseFloat(values[0]) + step;
        let newToYear = parseFloat(values[1]) + step;

        if (newFromYear > yearSlider.noUiSlider.options.range.max) {
            newFromYear = yearSlider.noUiSlider.options.range.max;
            clearInterval(intervalId);
            isAutoScrolling = false;
            button.innerText = 'Play'
        }

        if (newToYear > yearSlider.noUiSlider.options.range.max) {
            newToYear = yearSlider.noUiSlider.options.range.max;
            clearInterval(intervalId);
            isAutoScrolling = false;
            button.innerText = 'Play'
        }

        yearSlider.noUiSlider.set([newFromYear, newToYear]);
    }

    button.addEventListener('click', function() {
        if (!isAutoScrolling) {
            intervalId = setInterval(autoScrollSlider, 100);
            isAutoScrolling = true;
            button.innerText = 'Stop'
        } else {
            clearInterval(intervalId);
            isAutoScrolling = false;
            button.innerText = 'Play'
        }
    });

}

function mergeTooltips(slider, threshold, separator) {
    let textIsRtl = getComputedStyle(slider).direction === 'rtl';
    let isRtl = slider.noUiSlider.options.direction === 'rtl';
    let isVertical = slider.noUiSlider.options.orientation === 'vertical';
    let tooltips = slider.noUiSlider.getTooltips();
    let origins = slider.noUiSlider.getOrigins();

    // Move tooltips into the origin element. The default stylesheet handles this.
    tooltips.forEach(function (tooltip, index) {
        if (tooltip) {
            origins[index].appendChild(tooltip);
        }
    });

    slider.noUiSlider.on('update', function (values, handle, unencoded, tap, positions) {

        let pools = [[]];
        let poolPositions = [[]];
        let poolValues = [[]];
        let atPool = 0;

        // Assign the first tooltip to the first pool, if the tooltip is configured
        if (tooltips[0]) {
            pools[0][0] = 0;
            poolPositions[0][0] = positions[0];
            poolValues[0][0] = Math.round(values[0]);
        }

        for (let i = 1; i < positions.length; i++) {
            if (!tooltips[i] || (positions[i] - positions[i - 1]) > threshold) {
                atPool++;
                pools[atPool] = [];
                poolValues[atPool] = [];
                poolPositions[atPool] = [];
            }

            if (tooltips[i]) {
                pools[atPool].push(i);
                poolValues[atPool].push(Math.round(values[i]));
                poolPositions[atPool].push(positions[i]);
            }
        }

        pools.forEach(function (pool, poolIndex) {
            let handlesInPool = pool.length;

            for (let j = 0; j < handlesInPool; j++) {
                let handleNumber = pool[j];

                if (j === handlesInPool - 1) {
                    let offset = 0;

                    poolPositions[poolIndex].forEach(function (value) {
                        offset += 1000 - value;
                    });

                    let direction = isVertical ? 'bottom' : 'right';
                    let last = isRtl ? 0 : handlesInPool - 1;
                    let lastOffset = 1000 - poolPositions[poolIndex][last];
                    offset = (textIsRtl && !isVertical ? 100 : 0) + (offset / handlesInPool) - lastOffset;

                    // Center this tooltip over the affected handles
                    tooltips[handleNumber].innerHTML = poolValues[poolIndex].join(separator);
                    tooltips[handleNumber].style.display = 'block';
                    tooltips[handleNumber].style[direction] = offset + '%';
                } else {
                    // Hide this tooltip
                    tooltips[handleNumber].style.display = 'none';
                }
            }
        });
    });
}


function initializeTopCountriesScale() {
    // Size of the color scale bar
    const xPadding = 40;
    const width = 20 + xPadding;
    const height = 250;
    const svg = d3.select("#colorScale")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    // Number of sample points
    const numSamples = 100;
    // Create the rectangles
    svg.selectAll("rect")
        .data(d3.range(1, numSamples + 1))
        .enter()
        .append("rect")
        .attr("x", xPadding)
        .attr("y", (d, i) => i * (height / numSamples))
        .attr("width", width)
        .attr("height", height / numSamples)
        .attr("fill", d => lifeColorScale(d));

    let y = d3.scaleLinear().domain([100, 1]).range([height - 10, 10]);
        // Add Y axis
    svg.append("g")
        .attr("transform", "translate(" + (xPadding - 10) + ",-5)")
        .call(d3.axisLeft(y).tickValues([100, 1]));
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", xPadding - 15)
        .attr("x", -height / 2 + 35)
        .text("Rank");
}


function updateHeatmap(data) {
    // Calculate counts for each combination
    const counts = occupationCategories.flatMap(occupation => {
        return deathCategories.map(death => {
            const count = data.filter(d => d['Occupation category'] === occupation && d['Manner of death category'] === death).length;
            return { occupation, death, count };
        });
    });
    const totalCount = counts.reduce((sum, current) => sum + current.count, 0);

    // Calculate overall counts for each occupation category
    const overallOccupationCounts = occupationCategories.map(occupation => ({
        occupation,
        count: data.filter(d => d['Occupation category'] === occupation).length
    }));

    const xLabelsPadding = 200, yLabelsPadding = 150;
    const cellWidth = 70, cellHeight = 50;
    const svgWidth = occupationCategories.length * cellWidth + xLabelsPadding;
    const svgHeight = deathCategories.length * cellHeight + cellHeight + yLabelsPadding;

    // Select the SVG container, create it if it doesn't exist
    let svg = d3.select('#heatmap').select('svg');
    if (svg.empty()) {
        svg = d3.select('#heatmap')
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', svgHeight);

        // White background
        svg.append("rect")
            .attr("width", svgWidth)
            .attr("height", 325)
            .attr("x", 0)
            .attr("y", yLabelsPadding / 2)
            .attr("opacity", 0.5)
            .attr("rx", 10)
            .attr("ry", 10)
            .attr("fill", "white");

        // Title
        svg.append("text")
            .attr("text-anchor", "end")
            .attr("y", yLabelsPadding - 50)
            .attr("x", svgWidth - 10)
            .attr("font-size", 25)
            .text("Occupational Mortality Distribution ☠️");
    }

    // Bind data to rectangles for the grid
    const gridRects = svg.selectAll('.grid-rect').data(counts);
    gridRects.enter().append('rect')
        .attr('class', 'grid-rect')
        .merge(gridRects)
        .attr('x', (d, i) => Math.floor(i / deathCategories.length) * cellWidth + xLabelsPadding)
        .attr('y', (d, i) => cellHeight + (i % deathCategories.length) * cellHeight + yLabelsPadding)
        .attr('width', cellWidth)
        .attr('height', cellHeight)
        // .attr('stroke', 'white')
        .attr('fill', d => countColorScale(totalCount > 0 ? (d.count / totalCount) * 100 : 0));
    gridRects.exit().remove();

    // Bind data to text for the grid
    const gridTexts = svg.selectAll('.grid-text').data(counts);
    gridTexts.enter().append('text')
        .attr('class', 'grid-text')
        .merge(gridTexts)
        .attr('x', (d, i) => Math.floor(i / deathCategories.length) * cellWidth + xLabelsPadding + cellWidth / 2)
        .attr('y', (d, i) => cellHeight + (i % deathCategories.length) * cellHeight + yLabelsPadding + cellHeight / 2 - 10)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text(d => d.count);
    gridTexts.exit().remove();
    const gridPercTexts = svg.selectAll('.grid-perc-text').data(counts);
    gridTexts.enter().append('text')
        .attr('class', 'grid-perc-text')
        .merge(gridPercTexts)
        .attr('x', (d, i) => Math.floor(i / deathCategories.length) * cellWidth + xLabelsPadding + cellWidth / 2)
        .attr('y', (d, i) => cellHeight + (i % deathCategories.length) * cellHeight + yLabelsPadding + cellHeight / 2 + 10)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text(d => totalCount ? Math.floor(d.count / totalCount * 100) + "%" : "0%");
    gridTexts.exit().remove();

    // Bind data to rectangles for overall counts
    const overallRects = svg.selectAll('.overall-rect').data(overallOccupationCounts);
    overallRects.enter().append('rect')
        .attr('class', 'overall-rect')
        .merge(overallRects)
        .attr('x', (d, i) => i * cellWidth + xLabelsPadding)
        .attr('y', d => yLabelsPadding - 5)
        .attr('width', cellWidth)
        .attr('height', cellHeight)
        .attr('fill', d => occupationColors[d.occupation]);
    overallRects.exit().remove();

    // Bind data to text for overall counts
    const overallTexts = svg.selectAll('.overall-text').data(overallOccupationCounts);
    overallTexts.enter().append('text')
        .attr('class', 'overall-text')
        .merge(overallTexts)
        .attr('x', (d, i) => i * cellWidth + xLabelsPadding + cellWidth / 2)
        .attr('y', yLabelsPadding + cellHeight / 2 - 5)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text(d => d.count);
    overallTexts.exit().remove();

    // Create and bind data to text for death categories (as row headers)
    const deathCategoryTexts = svg.selectAll('.death-category-text').data(deathCategories);
    deathCategoryTexts.enter().append('text')
        .attr('class', 'death-category-text')
        .merge(deathCategoryTexts)
        .attr('x', xLabelsPadding - 10)
        .attr('y', (d, i) => cellHeight + i * cellHeight + cellHeight / 2 + yLabelsPadding)
        .attr('text-anchor', 'end')
        .attr('dy', '.35em')
        .text(d => d);
    deathCategoryTexts.exit().remove();

    // Create and bind data to text for occupation categories (as column headers)
    const occupationCategoryTexts = svg.selectAll('.occupation-category-text').data(occupationCategories);
    occupationCategoryTexts.enter().append('text')
        .attr('class', 'occupation-category-text')
        .merge(occupationCategoryTexts)
        .attr('x', (d, i) => i * cellWidth + xLabelsPadding + cellWidth / 2)
        .attr('y', yLabelsPadding - 20)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text(d => d);
    occupationCategoryTexts.exit().remove();
}

function quickselect(arr, k, left = 0, right = arr.length - 1) {
    while (right > left) {
        if (right - left > 600) {
            const n = right - left + 1;
            const m = k - left + 1;
            const z = Math.log(n);
            const s = 0.5 * Math.exp(2 * z / 3);
            const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            const newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            const newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            quickselect(arr, k, newLeft, newRight);
        }

        const t = arr[k];
        let i = left;
        let j = right;

        swap(arr, left, k);
        if (arr[right] > t) swap(arr, left, right);

        while (i < j) {
            swap(arr, i, j);
            i++;
            j--;
            while (arr[i] < t) i++;
            while (arr[j] > t) j--;
        }

        if (arr[left] === t) swap(arr, left, j);
        else {
            j++;
            swap(arr, j, right);
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}

function swap(arr, i, j) {
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
}

function quantile(arr, p) {
    if (arr.length === 0 || p < 0 || p > 1) return null;

    const sorted = arr.slice();
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (sorted.length === 1) return sorted[0];

    quickselect(sorted, lower);
    const valueLower = sorted[lower];

    if (lower === upper) return valueLower;

    quickselect(sorted, upper, lower);
    const valueUpper = sorted[upper];

    return Math.max(valueLower, valueLower + (valueUpper - valueLower) * (index - lower));
}

function stringToHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function LCG(seed) {
  this.seed = seed;
  this.a = 1664525;
  this.c = 1013904223;
  this.m = Math.pow(2, 32);

  this.next = () => {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m;
  };
}

// Function to get a random value based on a string
function randomFromString(str) {
  const seed = stringToHash(str);
  const lcg = new LCG(seed);
  return lcg.next();
}

function updateBoxplot(data) {
    let width = 75*6, height = 400;
    let xLabelsPadding = 135 + 50, yLabelsPadding = 25;

    // Compute quartiles, median, inter quantile range min and max
    let sumstat = d3.rollup(data, d => {
        // Map 'Age of death' once
        let ages = d.map(g => g['Age of death']);

        // Calculate quantiles on the sorted array
        let q1 = quantile(ages, .25);
        let median = quantile(ages, .5);
        let q3 = quantile(ages, .75);

        // Calculate other statistics
        let interQuantileRange = q3 - q1;
        let min = q1 - 1.5 * interQuantileRange;
        let max = q3 + 1.5 * interQuantileRange;

        return { q1: q1, median: median, q3: q3, min: min, max: max };
    }, d => d['Occupation category']);
    sumstat = Array.from(sumstat, ([key, value]) => ({ key, value }));

    // Select the SVG container, create it if it doesn't exist
    let x = d3.scaleBand().range([0, width]).domain(occupationCategories).padding(0.4);
    let y = d3.scaleLinear().domain([0, 120]).range([height, 0]);
    let svg = d3.select('#boxplot').select('svg');
    if (svg.empty()) {
        svg = d3.select("#boxplot")
                .append("svg")
                    .attr("transform", "translate(0,10)")
                    .attr("width", width + xLabelsPadding)
                    .attr("height", height + yLabelsPadding)

        // White background
        svg.append("rect")
            .attr("width", width)
            .attr("height", height + yLabelsPadding)
            .attr("x", xLabelsPadding - 60)
            .attr("y", 0)
            .attr("opacity", 0.5)
            .attr("rx", 10)
            .attr("ry", 10)
            .attr("fill", "white");

        // Add X axis
        svg.append("g")
            .attr("transform", "translate(" + xLabelsPadding + "," + (height - yLabelsPadding) + ")")
            .call(d3.axisBottom(x));
        svg.append("text")
            .attr("text-anchor", "end")
            .attr("y", height + yLabelsPadding - 15)
            .attr("x", width + 35)
            .text("Occupation Category");

        // Add Y axis legend
        const numSamples = 100;
        svg.selectAll("rect")
            .data(d3.range(1, numSamples + 1).reverse())
            .enter()
            .append("rect")
            .attr("transform", "translate(" + (xLabelsPadding - 10) + ",-" + yLabelsPadding + ")")
            .attr("x", 0)
            .attr("y", (d, i) => i * (height / numSamples))
            .attr("width", 10)
            .attr("height", height / numSamples)
            .attr("fill", d => deathColorScale(d));

        // Add Y axis
        svg.append("g")
            .attr("transform", "translate(" + (xLabelsPadding - 10) + ",-" + yLabelsPadding + ")")
            .call(d3.axisLeft(y));
        svg.append("text")
            .attr("text-anchor", "end")
            .attr("transform", "rotate(-90)")
            .attr("y", xLabelsPadding - 30 - 10)
            .attr("x", -height / 2 + 50)
            .text("Age of Death");
    }

    // Rectangle for the main box
    const whiskerBoxes = svg.selectAll('.boxes').data(sumstat);
    whiskerBoxes.enter().append("rect")
        .attr('class', 'boxes')
        .merge(whiskerBoxes)
        .attr("x", d => x(d.key) + xLabelsPadding)
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.value.q3) - yLabelsPadding)
        .attr("height", d => y(d.value.q1) - y(d.value.q3))
        .attr("stroke", "black")
        .style("fill", d => occupationColors[d.key]);
    whiskerBoxes.exit().remove();

    const vertLines = svg.selectAll(".vertLines").data(sumstat);
    vertLines.enter().append("line")
        .attr('class', 'vertLines')
        .merge(vertLines)
        .attr("x1", d => x(d.key) + x.bandwidth() / 2 + xLabelsPadding)
        .attr("x2", d => x(d.key) + x.bandwidth() / 2 + xLabelsPadding)
        .attr("y1", d => y(Math.max(1, d.value.min)) - yLabelsPadding)
        .attr("y2", d => y(d.value.max) - yLabelsPadding)
        .attr("stroke", "black")
        .style("width", 40);
    vertLines.exit().remove();

    const medianLines = svg.selectAll(".medianLines").data(sumstat);
    medianLines.enter().append("line")
        .attr('class', 'medianLines')
        .merge(medianLines)
        .attr("x1", d => x(d.key) + xLabelsPadding)
        .attr("x2", d => x(d.key) + x.bandwidth() + xLabelsPadding)
        .attr("y1", d => y(d.value.median) - yLabelsPadding)
        .attr("y2", d => y(d.value.median) - yLabelsPadding)
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    medianLines.exit().remove();

    // Check if the tooltip already exists
    let tooltip = d3.select("#boxplot").select(".tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("#boxplot").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("font-size", "10px");
    }

    // Add individual points with jitter
    let jitterWidth = 10;
    data = checkDataLimit(data, 1000)
    const points = svg.selectAll(".indPoints").data(data);
    points.enter().append("circle")
        .attr('class', 'indPoints')
        .merge(points)
        .attr("cx", d => x(d['Occupation category']) + x.bandwidth() / 2 + (randomFromString(d['Name']) * jitterWidth) + xLabelsPadding)
        .attr("cy", d => y(d['Age of death']) - yLabelsPadding)
        .attr("r", 4)
        .attr("stroke", "black")
        .attr("stroke-width", 0.5)
        .style("fill", d => deathColorScale(d['Age of death']))
        .style("opacity", 0.8)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            tooltip
                .transition()
                .duration(200)
                .style("opacity", 1);
            tooltip
                .html(get_tooltip_html(d))
                .style("left", (d3.pointer(event)[0] - 50) + "px")
                .style("top", (d3.pointer(event)[1] + 430) + "px");
        })
        .on("mousemove", (event, d) => {
            tooltip
                .style("left", (d3.pointer(event)[0] - 50) + "px")
                .style("top", (d3.pointer(event)[1] + 430) + "px");
        })
        .on("mouseleave", (event, d) => {
            tooltip
                .transition()
                .duration(0)
                .style("opacity", 0)
                .style("left", "-9999px")
                .style("top", "-9999px");
        })
        .on("click", (event, d) => {
            window.open(`https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/${d.Id}`, '_blank');
        });
    points.exit().remove();
}

function get_tooltip_html(d) {
    return `
    <div style="white-space: nowrap; color: white; padding: 5px; border-radius: 5px; background: rgba(0, 0, 0, 0.8);">
        <div><strong>Name:</strong> ${d.Name}</div>
        <div><strong>Description:</strong> ${d['Short description']}</div>
        <div><strong>Gender:</strong> ${d.Gender}</div>
        <div><strong>Years:</strong> ${d['Birth year']}-${d['Death year']} (aged ${d['Age of death']})</div>
        <div><strong>Country:</strong> ${d.Country}</div>
        <div><strong>Occupation:</strong> ${d['Occupation category']}: ${d.Occupation}</div>
        <div><strong>Manner of Death:</strong> ${d['Manner of death']}</div>
    </div>`
}

function checkDataLimit(data, limit) {
    if (data.length > limit) {
        console.debug("At least one category has reached the limit of " + limit + " records.");
        return data.slice(0, limit)
    }
    return data
}

function initializeFilters() {
    const sexFilter = document.getElementById('sex-filter');
    sexFilter.querySelectorAll('.form-check-input')
        .forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                let checkedValues = [];
                sexFilter.querySelectorAll('.form-check-input:checked').forEach(checkedBox => {
                    checkedValues.push(checkedBox.value);
                });
                selectedSex = checkedValues;
                update()
            });
        });

    const occupationFilter = document.getElementById('occupation-filter');
    occupationFilter.querySelectorAll('.form-check-input')
        .forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                let checkedValues = [];
                occupationFilter.querySelectorAll('.form-check-input:checked').forEach(checkedBox => {
                    checkedValues.push(checkedBox.value);
                });
                selectedOccupation = checkedValues;
                update()
            });
        });
}

function initialize() {
    initializeTopCountriesScale()
    initializeFilters()
    initializeSlider()
}

function update() {
    let data = dataset,
        country = selectedCountry,
        sex = selectedSex,
        occupation = selectedOccupation,
        years = selectedYears;

    console.debug(country, sex, occupation, years)

    if (country) {
        data = data.filter(d => d.Country === country)
    }
    if (sex && sex.length > 0) {
        data = data.filter(d => sex.includes(d['Gender']));
    }
    if (occupation && occupation.length > 0) {
        data = data.filter(d => occupation.includes(d['Occupation category']));
    }
    if (years) {
        let fromYear = years[0], toYear = years[1];
        data = data.filter(d => d['Death year'] <= toYear && d['Birth year'] >= fromYear);
    }
    updateGlobe(data)
    updateBoxplot(data)
    updateHeatmap(data)
}


function contentLoaded() {
    document.getElementById('spinner').remove();
    document.getElementById('content').style.display = 'block';
    document.getElementById('title').style.display = 'block';
    document.getElementById('legend').style.display = 'block';
    document.getElementById('filter').style.display = 'block';
}

(() => {
    initialize()
    update()
})();

