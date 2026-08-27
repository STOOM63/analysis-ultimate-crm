import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ctx',ROOT/'scripts'/'update_public_context.py')
ctx=importlib.util.module_from_spec(spec); spec.loader.exec_module(ctx)

catalog=[
 {'dataset_id':'occupation_parcs_stationnement_metropolitains','metas':{'default':{'title':'Occupation des Parcs de Stationnement Métropolitains','description':'temps réel parking'}}},
 {'dataset_id':'base-adresse-locale-clermont-auvergne-metropole','metas':{'default':{'title':'Base Adresse Locale - Clermont Auvergne Métropole','description':'adresses'}}},
 {'dataset_id':'axes-de-voie-de-la-metropole','metas':{'default':{'title':'Axes de voie de la Métropole','description':'voirie métropolitaine'}}},
 {'dataset_id':'travaux-voirie-test','metas':{'default':{'title':'Travaux et circulation','description':'Chantiers, déviations et fermetures de voirie'}}},
 {'dataset_id':'marches-publics','metas':{'default':{'title':'Marchés publics de travaux','description':'Achats publics'}}},
]
resolved=ctx.resolve_known_datasets(catalog)
assert resolved['parking']=='occupation_parcs_stationnement_metropolitains'
assert resolved['addresses']=='base-adresse-locale-clermont-auvergne-metropole'
assert resolved['roads']=='axes-de-voie-de-la-metropole'

rel=ctx.discover_relevant(catalog)
ids={x['dataset_id'] for x in rel}
assert 'travaux-voirie-test' in ids
assert 'occupation_parcs_stationnement_metropolitains' in ids
assert 'marches-publics' not in ids

p=ctx.normalize_parking_record({'nom':'Jaude','capacite':100,'places_disponibles':25,'geo_point_2d':{'lat':45.77,'lon':3.08}})
assert p['name']=='Jaude'
assert p['capacity']==100
assert p['available']==25
assert round(p['occupancy_pct'],1)==75.0
assert p['lat']==45.77 and p['lon']==3.08

assert ctx.infer_sector_from_text('Travaux à Lempdes avec circulation alternée')=='Nord & Est'
assert ctx.infer_sector_from_text('Chantier avenue à Cournon-d’Auvergne')=='Sud'
assert ctx.infer_sector_from_text('Rue Blatin à Clermont-Ferrand')=='Clermont-Centre'

merged=ctx.merge_works([
 {'sector':'Nord & Est','place':'Aulnat','text':'Travaux route barrée rue Jules Verne','source_type':'clermont_api'}
],[
 {'sector':'Nord & Est','place':'Aulnat','text':'Travaux route barrée rue Jules Verne à Aulnat','source_type':'official_page'}
])
assert len(merged)==1

payload={'schema_version':2,'works':[],'weather':[],'source_health':[],'clermont_api':{'health':{}}}
assert ctx.validate_payload(payload)==[]
print('test_public_context: OK')
