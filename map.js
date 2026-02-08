const map=L.map("map",{maxBounds:[[54,-9],[62,0]]}).setView([57.6,-4.1],7); // create map object (blank & empty), set bounds, initial viewpoint & zoom
const maptions={
    maxZoom:20,
    minZoom:7,
    attribution:"&copy; <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a>"
}
const normal=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",maptions).addTo(map); // osm map images
// const alt=L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",maptions); // alt tileLayer with different map style
// const layerControl=L.control.layers({"normal":normal,"alt":alt},[]).addTo(map); // allow switching between map styles

const icons={ // get icons & create leaflet icon objects
    "accom":L.icon({
        iconUrl:'icons/accom.svg',
        iconSize:[34.6,50],
        iconAnchor:[17.3,50]
    }),
    "study":L.icon({
        iconUrl:'icons/study.svg',
        iconSize:[34.6,50],
        iconAnchor:[17.3,50]
    }),
    "interest":L.icon({
        iconUrl:'icons/interest.svg',
        iconSize:[34.6,50],
        iconAnchor:[17.3,50]
    }),
    "culture":L.icon({
        iconUrl:'icons/culture.svg',
        iconSize:[34.6,50],
        iconAnchor:[17.3,50]
    }),
    "shop/food":L.icon({
        iconUrl:'icons/shop_food.svg',
        iconSize:[34.6,50],
        iconAnchor:[17.3,50]
    }),
    "ferry":L.icon({
        iconUrl:'icons/ferry.svg',
        iconSize:[34.6,50],
        iconAnchor:[17.3,50]
    })
}

// hard coding the amount of routes cause it's very hard to get client side js to scan a server side folder
// & I didn't want to write an extra thing running server side just for this
for (let i=0;i<3;i++) {
    const routePoints=await fetch(`./generated_route_${i}.csv`) // get driving route points
    .then(r=>r.text())
    .then(text=>text.split("\n").map(line=>line.split(","))); // format csv to array of [lat,lng]
    L.polyline(routePoints,{smoothFactor:3,weight:5}).addTo(map); // render polyline from route
}
for (let i=0;i<2;i++) { // do the same for ferry routes
    const routePoints=await fetch(`./ferry_route_${i}.csv`)
    .then(r=>r.text())
    .then(text=>text.split("\n").map(line=>line.split(",")));
    L.polyline(routePoints,{smoothFactor:3,weight:2.5,dashArray:"5 7"}).addTo(map);
}

const locations=await fetch("./locations.csv") // get locations
.then(r=>r.text())
.then(text=> // format csv to array of objects for each location
    text.split("\n")
    .filter(Boolean) // remove empty lines (text editors always add one at the end of csv when saving)
    .map(line=>line.split(","))
    .map(line=>{return {
        "name":line[0],
        "icon":line[1],
        "description":line[2].replace(";",","),
        "coords":[line[3],line[4]],
        "link":line[5],
        "zoomThreshold":line[6],
        "region":line[7],
        "marker":{}
    }})
);

let currentPopup; // when a new popup is created & assigned to this var, leaflet removes the old one
// so declaring here (globally) means only one popup can show at a time
function createPopup(location) {
    currentPopup=L.popup().setLatLng(location.coords) // create popup at location
    .setContent( // content of popup
        `<div>
            <h4>${location.name}</h4>
            <a href="http://${location.link}">
                <svg width="13" height="13" viewBox="0 0 100 100">
                    <path fill="#0000" stroke="#05C" stroke-width="10"
                    d="m43,35H5v60h60V57M45,5v10l10,10-30,30 20,20 30-30 10,10h10V5z"/>
                </svg>
            </a>
        </div>
        <p>${location.description}</p>`
    )
    .openOn(map); // render
}

locations.map(location=>{
	console.log(location);
    const marker=L.marker(location.coords,{icon:icons[location.icon]}); // create marker for each location
    marker.on("mouseover",e_hover=>{ // when hovering over icon
        createPopup(location);
        const rect=currentPopup.getElement().getBoundingClientRect(); // get currentPopup borders
        const customBottom=e_hover.containerPoint.y; // get location's y coord
        const ac=new AbortController(); // declared here so that it's signal only works for this event listener
        document.addEventListener("mousemove",e=>{ // listener
            (e.clientX<rect.left || rect.right<e.clientX || e.clientY<rect.top || customBottom<e.clientY)?map.closePopup(currentPopup):null;
            // close popup if mouse leaves the popup area (lower bound being the location's y instead of the bottom of the popup box)
        },{signal:ac.signal}); // this makes ac.abort() effective on this listener
        currentPopup.on("remove",()=>ac.abort()); // stop listening for mouse location when popup closes (for any reason)
    });
    location.marker=marker;
    location.zoomThreshold==7?marker.addTo(map):{}; // only render markers with zoomThreshold 7 on initial load
    return location;
});

let currentRegion;
locations.forEach(location=>{ // add locations to index
    const indexList=document.getElementById("index").lastElementChild;
    if (location.region!=currentRegion) { // new region
        currentRegion=location.region;
        indexList.appendChild(document.createElement("br"));
        const regionHeader=document.createElement("h4");
        indexList.appendChild(regionHeader);
        regionHeader.textContent=currentRegion;
    }
    const p=document.createElement("p");
    indexList.appendChild(p);
    p.textContent=location.name;
    let zoom=10; // determine zoom level to view location when clicked
    locations.forEach(otherLocation=>{
        const [x,y,x1,y1]=[...location.coords,...otherLocation.coords];
        const squareDist=(x-x1)*(x-x1)+(y-y1)*(y-y1);
        if (squareDist==0) {
            return;
        } if (squareDist<0.000025) {
            zoom=14;
            return;
        } if (squareDist<0.000225) {
            zoom=13>zoom?13:zoom;
        } else if (squareDist<0.0009) {
            zoom=12>zoom?12:zoom;
        } else if (squareDist<0.0025) {
            zoom=zoom==10?11:zoom;
        }
    });
    p.onclick=()=>{ // maybe generalise this func
        createPopup(location);
        map.setView(location.coords,zoom); // set map view to selected location marker position (zoom determined above)
    };
});

map.on("zoomend",()=>{
    const zoom=map.getZoom();
    locations.forEach(location=>{
        zoom>=location.zoomThreshold?map.addLayer(location.marker):map.removeLayer(location.marker);
    });
});
