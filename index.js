import fetch from 'isomorphic-fetch'
import mapbox from 'mapbox-gl'
import turfExtent from 'turf-extent'

import './style.css'

const root = document.getElementById('root')

root.innerHTML = `
  <div id="map"></div>
  <div id="menu">
    <select id="systems-select">
      <option value="none">Select a system</option>
    </select>
    <div id="system-info"></div>
  </div>
`

// run!

let Systems = window.Systems = {}

run()

mapbox.accessToken = process.env.MAPBOX_ACCESS_TOKEN
const map = new mapbox.Map({
  container: 'map',
  style: process.env.MAPBOX_MAP_STYLE,
  zoom: 14
})

const systemInfo = document.getElementById('system-info')
const systemsSelect = document.getElementById('systems-select')

systemsSelect.onchange = function (event) {
  console.log(event)
  const id = event.target.value
  if (id !== 'none') selectSystem(id)
}

function selectSystem (id) {
  const System = Systems[id]

  systemInfo.innerHTML = Object.keys(System).map((key) => {
    return `<p><b>${key}:</b> ${System[key]}</p>`
  }).join('')

  if (System.geojson) {
    map.fitBounds(turfExtent(System.geojson))
  } else {
    updateStations(System)
  }
}

async function run () {
  try {
    await getSystems()
  } catch (e) {
    console.error(e.stack)
  }

  Object.keys(Systems).forEach((id) => {
    const System = Systems[id]
    const option = document.createElement('option')
    option.value = id
    option.appendChild(document.createTextNode(System.name))
    systemsSelect.appendChild(option)
  })
}

function getSystems () {
  return fetch('./gbfs/systems.csv')
    .then((res) => res.text())
    .then((csv) => {
      csv
        .split('\n')
        .slice(1, -1)
        .map((row) => {
          const quotes = row.split('"')
          return [...quotes[0].slice(0, -1).split(','), quotes[1], ...quotes[2].slice(1).split(',')]
        })
        .forEach((row) => {
          Systems[row[3]] = {
            country: row[0],
            gbfs: row[5],
            id: row[3],
            location: row[2],
            name: row[1],
            url: row[4]
          }
        })
    })
    .catch((e) => {
      throw e
    })
}

function updateStations (System, infoUrl) {
  return fetch(`./gbfs/${System.id}/station_information.json`)
    .then((res) => res.json())
    .then((gbfs) => {
      System.geojson = gbfs2geojson(gbfs)

      map.addSource(System.id, {
        cluster: true,
        clusterRadius: 25,
        data: System.geojson,
        type: 'geojson'
      })

      map.addLayer({
        id: System.id,
        layout: {
          'icon-image': 'marker-15'
        },
        source: System.id,
        type: 'symbol'
      })

      const clusterLayers = [
        [150, '#f28cb1'],
        [20, '#f1f075'],
        [0, '#51bbd6']
      ]

      clusterLayers.forEach((layer, i) => {
        map.addLayer({
          id: `${System.id}-cluster-${i}`,
          type: 'circle',
          source: System.id,
          paint: {
            'circle-color': layer[1],
            'circle-radius': 18,
            'circle-opacity': 0.5
          },
          filter: i === 0
            ? ['>=', 'point_count', layer[0]]
            : ['all',
              ['>=', 'point_count', layer[0]],
              ['<', 'point_count', clusterLayers[i - 1][0]]]
        })
      })

      map.addLayer({
        id: `${System.id}-cluster-count`,
        type: 'symbol',
        source: System.id,
        layout: {
          'text-field': '{point_count}',
          'text-font': [
            'DIN Offc Pro Medium',
            'Arial Unicode MS Bold'
          ],
          'text-size': 12
        }
      })

      map.fitBounds(turfExtent(System.geojson))
    })
    .catch((e) => {
      throw e
    })
}

function gbfs2geojson (station_information) {
  return {
    type: 'FeatureCollection',
    features: station_information.data.stations.map(function (station) {
      return {
        type: 'Feature',
        properties: station,
        geometry: {
          type: 'Point',
          coordinates: [
            station.lon,
            station.lat
          ]
        }
      }
    })
  }
}
