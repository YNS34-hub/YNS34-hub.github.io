import unreal as u, json, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
levels=u.get_editor_subsystem(u.LevelEditorSubsystem)
actors=u.get_editor_subsystem(u.EditorActorSubsystem)
report={}
for mode in ['TrainingHall','LakesideRide']:
    levels.load_level('/Game/MemorySports/Maps/'+mode)
    info=[]
    for actor in actors.get_all_level_actors():
        if isinstance(actor,u.DirectionalLight):
            c=actor.get_component_by_class(u.DirectionalLightComponent)
            info.append({'actor':actor.get_actor_label(),'intensity':c.get_editor_property('intensity'),'rotation':str(actor.get_actor_rotation()),'sun':c.get_editor_property('atmosphere_sun_light')})
        if isinstance(actor,u.PostProcessVolume):
            settings=actor.get_editor_property('settings')
            info.append({'exposure':settings.get_editor_property('auto_exposure_bias'),'unbound':actor.get_editor_property('unbound')})
    report[mode]=info
mesh=u.load_asset('/Game/MemorySports/AthleteNative/athlete/SkeletalMeshes/athlete')
report['bounds']=str(mesh.get_bounds())
report['cvars']={key:u.SystemLibrary.get_console_variable_int_value(key) for key in ['r.SkyAtmosphere','r.SupportSkyAtmosphere','r.AllowStaticLighting']}
with open(os.path.join(ROOT,'Reports/native-inspection.json'),'w',encoding='utf-8') as f:json.dump(report,f,indent=2)
u.log('SPORTS_NATIVE_INSPECTION '+json.dumps(report))
