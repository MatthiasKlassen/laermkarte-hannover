import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBNmZjVFgeqgUdHmcZYzSPV1kTiJSPkUTM",
    authDomain: "laermjaeger.firebaseapp.com",
    projectId: "laermjaeger",
    storageBucket: "laermjaeger.appspot.com",  
    messagingSenderId: "738314658200",
    appId: "1:738314658200:web:bfadd216c180ebdcb78bed",
    measurementId: "G-JQQ4CXR7GD"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async function() {
    var map = L.map('map').setView([52.3759, 9.7320], 14); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    function getColor(dB) {
        return dB < 50 ? "green" :
                dB < 60 ? "yellowgreen" :
                dB < 70 ? "yellow" :
                dB < 80 ? "orange" :
                dB < 90 ? "orangered" :
                dB < 100 ? "red" : "darkred";
    }

    var hexagons = {};
    var allPoints = [];
    var hexGridLayer;

    async function loadLaermData() {
        const querySnapshot = await getDocs(collection(db, "laermDaten"));
        let points = [];
        let bbox = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity }; 

        querySnapshot.forEach((doc) => {
            let data = doc.data();
            points.push(turf.point([data.lng, data.lat], { value: data.value, timestamp: data.timestamp }));

            if (data.lat < bbox.minLat) bbox.minLat = data.lat;
            if (data.lat > bbox.maxLat) bbox.maxLat = data.lat;
            if (data.lng < bbox.minLng) bbox.minLng = data.lng;
            if (data.lng > bbox.maxLng) bbox.maxLng = data.lng;

            L.circleMarker([data.lat, data.lng], {
                radius: 3,
                fillColor: "white", 
                color: "lightgrey", 
                weight: 1,
                opacity: 1,
                fillOpacity: 1
            }).addTo(map);
        });

        let gridBBox = [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat];
        let hexGrid = turf.hexGrid(gridBBox, 0.1, { units: 'kilometers' });

        hexGrid.features.forEach(hex => {
            let hexPoints = points.filter(point => turf.booleanPointInPolygon(point, hex));
            if (hexPoints.length > 0) {
                let avgValue = Math.round(hexPoints.reduce((sum, p) => sum + p.properties.value, 0) / hexPoints.length);
                hex.properties.avgValue = avgValue;
            } else {
                hex.properties.avgValue = null;
            }
        });

        allPoints = points;
        hexGridLayer = L.geoJson(hexGrid, {
            style: feature => ({
                fillColor: feature.properties.avgValue !== null ? getColor(feature.properties.avgValue) : "transparent",
                weight: 0,
                opacity: 0,
                color: "white",
                fillOpacity: 0.6
            })
        }).addTo(map);

        filterDataByTime(-1);
    }

    await loadLaermData();

    // const timeDropdown = document.getElementById('time-dropdown');
    // timeDropdown.value = -1; 

    // timeDropdown.addEventListener('change', function() {
    //     const selectedTime = parseInt(this.value);
    //     const timeString = selectedTime === -1 ? "Gesamtzeit" : `${selectedTime.toString().padStart(2, '0')}:00`;
    //     document.getElementById('slider-label').textContent = timeString;
    //     filterDataByTime(selectedTime);
    // });

    const filterCheck = document.getElementById("filterBool");
    const timeInput = document.getElementsByClassName("timeInput")
    var showing = false;

    filterCheck.addEventListener('click', function() {
        if (!showing) {
            Array.from(timeInput).forEach((thing) => {
                thing.style.display = "inline";
            })
            showing = true;
        } else {
            Array.from(timeInput).forEach((thing) => {
                thing.style.display = "none";
            })
            showing = false;
            filterDataByTime(undefined, undefined, true)
        }
        console.log(showing)
    });

    const timeStart = this.getElementById("timeStart")
    var timeStartVal = 0;
    const timeEnd = this.getElementById("timeEnd")
    var timeEndVal = 23;
    var temp;

    timeStart.addEventListener('change', function() {
        [timeStartVal, temp] = timeStart.value.split(":")
        filterDataByTime(timeStartVal, timeEndVal, false)
    });

    timeEnd.addEventListener('change', function() {
        [timeEndVal, temp] = timeEnd.value.split(":")
        filterDataByTime(timeStartVal, timeEndVal, false)
    });

    async function filterDataByTime(startTime, endTime, full=true) {
        hexGridLayer.clearLayers();
        
        let filteredPoints = [];
        if (full) {
            filteredPoints = allPoints; // Gesamtzeit: Alle Daten anzeigen
        } else {
            allPoints.forEach(point => {
                const timestamp = new Date(point.properties.timestamp);
                const hour = timestamp.getHours();
                if (hour >= startTime && hour <= endTime) {
                    filteredPoints.push(point);
                }
            });
        }

        updateHexagons(filteredPoints);
    }

    async function updateHexagons(points) {
        let hexagons = {};
        const querySnapshot = await getDocs(collection(db, "laermDaten"));
        let bbox = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };

        querySnapshot.forEach((doc) => {
            let data = doc.data();
            if (data.lat < bbox.minLat) bbox.minLat = data.lat;
            if (data.lat > bbox.maxLat) bbox.maxLat = data.lat;
            if (data.lng < bbox.minLng) bbox.minLng = data.lng;
            if (data.lng > bbox.maxLng) bbox.maxLng = data.lng;
        });

        points.forEach(point => {
            let lat = point.geometry.coordinates[1];
            let lng = point.geometry.coordinates[0];
            let value = point.properties.value;

            let hexKey = `${Math.round(lat * 1000) / 1000},${Math.round(lng * 1000) / 1000}`;
            if (hexagons[hexKey]) {
                let hex = hexagons[hexKey];
                hex.values.push(value);
                hex.avgValue = Math.round(hex.values.reduce((a, b) => a + b) / hex.values.length);
            } else {
                hexagons[hexKey] = { lat, lng, values: [value], avgValue: value };
            }
        });

        let gridBBox = [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat];
        let hexGrid = turf.hexGrid(gridBBox, 0.1, { units: 'kilometers' });
        hexGrid.features.forEach(hex => {
            let hexPoints = points.filter(point => turf.booleanPointInPolygon(point, hex));
            if (hexPoints.length > 0) {
                let avgValue = Math.round(hexPoints.reduce((sum, p) => sum + p.properties.value, 0) / hexPoints.length);
                hex.properties.avgValue = avgValue;
            } else {
                hex.properties.avgValue = null;
            }
        });

        hexGridLayer = L.geoJson(hexGrid, {
            style: feature => ({
                fillColor: feature.properties.avgValue !== null ? getColor(feature.properties.avgValue) : "transparent",
                weight: 0,
                opacity: 0,
                color: "white",
                fillOpacity: 0.6
            })
        }).addTo(map);
    }
    map.on('click', async function(e) {
        let lat = e.latlng.lat;
        let lng = e.latlng.lng;
        let value = prompt("Gib den Lärmpegel in dB ein (40-120):");
        if (value !== null) {
            value = parseInt(value);
            if (!isNaN(value) && value >= 40 && value <= 120) {
                let name = prompt("Gib den Jägernamen ein:");
                if (name !== null && name.trim() !== "") {
                    await addDoc(collection(db, "laermDaten"), {
                        lat, lng, value, name,
                        timestamp: new Date().toISOString()
                    });
                    location.reload();
                } else {
                    alert("Bitte einen gültigen Jägernamen eingeben.");
                }
            } else {
                alert("Bitte einen gültigen Wert zwischen 40 und 120 dB eingeben.");
            }
        }
    });
});