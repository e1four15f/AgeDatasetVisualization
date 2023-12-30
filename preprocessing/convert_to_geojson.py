import json
import geopandas as gpd
from shapely.geometry import mapping, Polygon, MultiPolygon

# Replace 'path_to_your_shapefile.shp' with the path to your Shapefile
gdf = gpd.read_file('data/ne_110m_admin_0_countries/ne_110m_admin_0_countries.shp')
gdf['area'] = gdf['geometry'].area.values
gdf = gdf.rename({'NAME': 'name'}, axis=1)

gdf = gdf[['name', 'area', 'geometry']]

# Function to return the largest polygon from a MultiPolygon
def largest_polygon(multipolygon):
    if isinstance(multipolygon, Polygon):
        return multipolygon
    elif isinstance(multipolygon, MultiPolygon):
        # Sort the polygons in the MultiPolygon by area and return the largest
        largest = max(multipolygon.geoms, key=lambda p: p.area)
        return largest
    else:
        return None

# Calculate the centroid for each country
gdf['centroid'] = gdf['geometry'].apply(largest_polygon).centroid
# Convert geometry to Python primitives (GeoJSON format)
gdf['geometry'] = gdf['geometry'].apply(lambda x: mapping(x))

# data = {"type": "FeatureCollectioon", "features": []}
# for _, row in gdf.iterrows():
#     data['features'].append(dict(**row.to_dict(), **{"type":"Feature"}))
# with open('js/public/data/ne_110m_admin_0_countries.json', 'w') as f:
#     json.dump(data, f)


with open('../js/public/data/ne_110m_admin_0_countries.json', 'w') as f:
    f.write('{"type":"FeatureCollection","features":[' + '\n')
    for i, (_, row) in enumerate(gdf.iterrows()):
        # Convert each row to a JSON formatted string
        dict_row = {
            "type": "Feature",
            "properties": {
                "name": row['name'],
                "lat": round(row['centroid'].y, 2),
                "lng": round(row['centroid'].x, 2),
                "area": int(row['area'])
            },
            "geometry": {
                "type": row.geometry['type'],
                "coordinates": row.geometry['coordinates']
            },
            "id": row.name
        }
        json_str = json.dumps(dict_row)
        if i == len(gdf) - 1:
            f.write(json_str + '\n')
        else:
            # Write the JSON string to a file, with each JSON object on its own line
            f.write(json_str + ',\n')
    f.write(']}')