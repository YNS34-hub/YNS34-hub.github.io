"""在本机 Unreal 中创建可编辑材质和地图，所有资产只写入本工程。"""
import unreal as u
import os, json, math, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from water_material import configure_water
from court_materials import configure_court_materials
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE='/Game/MemorySports'
tools=u.AssetToolsHelpers.get_asset_tools()
lib=u.MaterialEditingLibrary
eal=u.EditorAssetLibrary
report={'imports':[], 'materials':[], 'maps':[]}

def import_file(filename, destination):
    task=u.AssetImportTask()
    task.filename=os.path.join(ROOT,'InputAssets',filename)
    task.destination_path=destination
    task.automated=True;task.replace_existing=True;task.save=True
    tools.import_asset_tasks([task])
    report['imports'].extend(task.imported_object_paths)
    return [u.load_asset(p) for p in task.imported_object_paths]

textures={}
for filename in sorted(os.listdir(os.path.join(ROOT,'InputAssets'))):
    if filename.endswith('.png'):
        imported=import_file(filename,BASE+'/Textures')
        tex=next((a for a in imported if isinstance(a,u.Texture2D)),None)
        if tex:
            textures[os.path.splitext(filename)[0]]=tex
            if 'normal' in filename.lower():
                tex.set_editor_property('compression_settings',u.TextureCompressionSettings.TC_NORMALMAP)
                tex.set_editor_property('srgb',False)
                tex.set_editor_property('flip_green_channel',filename!='WaterNormal.png')
            tex.set_editor_property('max_texture_size',4096 if filename=='SkyPhoto.png' else 1024)
            eal.save_loaded_asset(tex)
sky_objects=import_file('SkyLighting.hdr',BASE+'/Textures')
sky_cube=next(a for a in sky_objects if isinstance(a,u.TextureCube))
sky_scale=json.load(open(os.path.join(ROOT,'Reports/sky-calibration.json'),encoding='utf-8'))['intensityMultiplier']
for filename in ['Bounce.wav','Rim.wav','Swish.wav','Shift.wav','RideWind.wav']:
    imported=import_file(filename,BASE+'/Sounds')
    if filename=='RideWind.wav':
        wave=next(a for a in imported if isinstance(a,u.SoundWave));wave.set_editor_property('looping',True);eal.save_loaded_asset(wave)
for filename in ['Fir.gltf','Wheel.gltf','GrassClump.gltf','ShoreStone.gltf']:
    import_file(filename,BASE+'/Scans')

def expression(mat, cls, **properties):
    node=lib.create_material_expression(mat,cls)
    for key,value in properties.items():node.set_editor_property(key,value)
    return node
def scalar(mat,value):return expression(mat,u.MaterialExpressionConstant,r=float(value))
def output(mat,node,prop):
    if not lib.connect_material_property(node,'',prop):raise RuntimeError('材质输出连接失败：'+str(prop))
def connect(a,b,slot,output_name=''):
    slot='UVs' if slot=='Coordinates' else slot
    slot='' if slot=='Input' else slot
    if not lib.connect_material_expressions(a,output_name,b,slot):raise RuntimeError('材质节点连接失败：'+b.get_class().get_name()+' / '+slot)

def operation(mat,cls,a,b):
    node=expression(mat,cls);connect(a,node,'A');connect(b,node,'B');return node

def mask(mat,node,r=False,g=False,b=False):
    result=expression(mat,u.MaterialExpressionComponentMask,r=r,g=g,b=b)
    connect(node,result,'Input');return result

def landscape_color(mat,name,base):
    # 山壁使用三轴世界投影，避免平面 UV 在陡坡上拉成条纹。
    position=expression(mat,u.MaterialExpressionWorldPosition)
    if name=='Rock':
        coordinate=operation(mat,u.MaterialExpressionMultiply,position,scalar(mat,.00015))
        normal=expression(mat,u.MaterialExpressionVertexNormalWS)
        absolute=expression(mat,u.MaterialExpressionAbs);connect(normal,absolute,'Input')
        weights=expression(mat,u.MaterialExpressionPower);connect(absolute,weights,'Base');connect(scalar(mat,4),weights,'Exp')
        total=operation(mat,u.MaterialExpressionDotProduct,weights,expression(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(1,1,1,1)))
        weights=operation(mat,u.MaterialExpressionDivide,weights,total)
        terms=[]
        for plane,axis in [((True,True,False),(False,False,True)),((True,False,True),(False,True,False)),((False,True,True),(True,False,False))]:
            sample=expression(mat,u.MaterialExpressionTextureSample,texture=textures[name])
            connect(mask(mat,coordinate,*plane),sample,'Coordinates')
            terms.append(operation(mat,u.MaterialExpressionMultiply,sample,mask(mat,weights,*axis)))
        base=operation(mat,u.MaterialExpressionAdd,operation(mat,u.MaterialExpressionAdd,terms[0],terms[1]),terms[2])
        base=operation(mat,u.MaterialExpressionMultiply,base,expression(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(.68,.76,.81,1)))
    macro=expression(mat,u.MaterialExpressionTextureSample,texture=textures['MacroVariation'])
    macro_uv=operation(mat,u.MaterialExpressionMultiply,mask(mat,position,True,True,False),scalar(mat,1/65000))
    connect(macro_uv,macro,'Coordinates')
    if name=='Meadow':
        # 底色与法线使用同一世界尺度，消除导出 UV 与法线瓦片错位造成的重复条带。
        ground_uv=operation(mat,u.MaterialExpressionMultiply,mask(mat,position,True,True,False),scalar(mat,1/650))
        connect(ground_uv,base,'Coordinates')
        soften=expression(mat,u.MaterialExpressionLinearInterpolate)
        connect(base,soften,'A')
        connect(expression(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(.10,.16,.042,1)),soften,'B')
        connect(scalar(mat,.52),soften,'Alpha');base=soften
    variation=operation(mat,u.MaterialExpressionAdd,operation(mat,u.MaterialExpressionMultiply,macro,scalar(mat,.22 if name=='Meadow' else .65)),scalar(mat,.80 if name=='Meadow' else .65))
    return operation(mat,u.MaterialExpressionMultiply,base,variation)

palette={
 'Concrete':((.19,.21,.20),.91,0),'White':((.84,.86,.80),.54,0),
 'Steel':((.12,.16,.17),.34,.82),'Padding':((.018,.065,.071),.74,0),
 'Rim':((.76,.16,.035),.36,.35),'Net':((.72,.75,.66),.9,0),
 'Paint':((.038,.12,.12),.32,0),'Seats':((.035,.078,.073),.63,0),
 'Wall':((.29,.34,.32),.84,0),'Ceiling':((.035,.055,.058),.78,.3),
 'BikePaint':((.56,.78,.15),.23,.62),'Rubber':((.008,.012,.014),.76,0),
 'Wood':((.6,.4,.2),.37,0),'Asphalt':((.06,.07,.07),.91,0),
 'Meadow':((.18,.24,.1),.96,0),'Rock':((.3,.33,.3),.92,0),'Ball':((.6,.2,.04),.64,0),
 'Glass':((.12,.24,.25),.12,0),'Light':((.8,.87,.77),.4,0),
 'Water':((.015,.065,.072),.24,0),
 'Bark':((.14,.12,.08),.94,0),'Needles':((.06,.14,.025),.83,0),'Sky':((.2,.4,.7),1,0),
 'Grass':((.12,.18,.035),.94,0),'Gravel':((.24,.23,.18),.94,0),'Timber':((.14,.085,.034),.81,0),
 'Cone':((.82,.24,.025),.62,0),'Fabric':((.70,.73,.66),.93,0)
}
for name,(color,rough,metal) in palette.items():
    path=BASE+'/Materials/M_'+name
    mat=u.load_asset(path) or tools.create_asset('M_'+name,BASE+'/Materials',u.Material,u.MaterialFactoryNew())
    # 当前引擎的批量删除会在遍历时修改表达式集合；复制后逐个删除，避免旧法线和旧节点残留。
    for old_expression in list(lib.get_material_expressions(mat)):
        lib.delete_material_expression(mat,old_expression)
    mat.set_editor_property('two_sided',name in ['Glass','Water','Meadow','Rock','Needles','Grass','Sky'])
    lib.set_material_usage(mat,u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES)
    lib.set_material_usage(mat,u.MaterialUsage.MATUSAGE_SKELETAL_MESH)
    base=expression(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(*color,1))
    if name in textures:
        base=expression(mat,u.MaterialExpressionTextureSample,texture=textures[name])
        uv=expression(mat,u.MaterialExpressionTextureCoordinate,u_tiling=18 if name=='Wood' else 1,v_tiling=12 if name=='Wood' else 1)
        connect(uv,base,'Coordinates')
    if name in ['Meadow','Rock']:base=landscape_color(mat,name,base)
    if name=='Grass':
        random=expression(mat,u.MaterialExpressionPerInstanceRandom)
        tint=operation(mat,u.MaterialExpressionAdd,operation(mat,u.MaterialExpressionMultiply,random,scalar(mat,.7)),scalar(mat,.65))
        base=operation(mat,u.MaterialExpressionMultiply,base,tint)
    output(mat,base,u.MaterialProperty.MP_BASE_COLOR)
    output(mat,scalar(mat,rough),u.MaterialProperty.MP_ROUGHNESS)
    output(mat,scalar(mat,metal),u.MaterialProperty.MP_METALLIC)
    if name=='Sky':
        mat.set_editor_property('shading_model',u.MaterialShadingModel.MSM_UNLIT)
        mat.set_editor_property('is_sky',False)
        sky_sample=expression(mat,u.MaterialExpressionTextureSample,texture=textures['SkyPhoto'])
        radiance=expression(mat,u.MaterialExpressionMultiply);connect(sky_sample,radiance,'A');connect(scalar(mat,8000),radiance,'B')
        output(mat,radiance,u.MaterialProperty.MP_EMISSIVE_COLOR)
    if name in ['Meadow','Asphalt']:
        normal=expression(mat,u.MaterialExpressionTextureSample,texture=textures[name+'Normal'],sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        if name=='Meadow':
            pos=expression(mat,u.MaterialExpressionWorldPosition)
            uv=operation(mat,u.MaterialExpressionMultiply,mask(mat,pos,True,True,False),scalar(mat,1/650))
            connect(uv,normal,'Coordinates')
            soften=expression(mat,u.MaterialExpressionLinearInterpolate)
            connect(normal,soften,'A')
            connect(expression(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(0,0,1,1)),soften,'B')
            connect(scalar(mat,.65),soften,'Alpha');normal=soften
        output(mat,normal,u.MaterialProperty.MP_NORMAL)
    if name=='Rock':
        output(mat,expression(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(0,0,1,1)),u.MaterialProperty.MP_NORMAL)
    if name in ['Bark','Needles']:
        prefix='fir_tree_01-'+('twig' if name=='Needles' else 'bark')
        tex=expression(mat,u.MaterialExpressionTextureSample,texture=textures[prefix+'-color'])
        output(mat,tex,u.MaterialProperty.MP_BASE_COLOR)
        normal=expression(mat,u.MaterialExpressionTextureSample,texture=textures[prefix+'-normal'],sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        output(mat,normal,u.MaterialProperty.MP_NORMAL)
        if name=='Needles':
            mat.set_editor_property('shading_model',u.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE)
            output(mat,expression(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(.12,.19,.035,1)),u.MaterialProperty.MP_SUBSURFACE_COLOR)
            mat.set_editor_property('blend_mode',u.BlendMode.BLEND_MASKED)
            mat.set_editor_property('opacity_mask_clip_value',.42)
            lib.connect_material_property(tex,'A',u.MaterialProperty.MP_OPACITY_MASK)
    if name=='Grass':
        mat.set_editor_property('shading_model',u.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE)
        output(mat,expression(mat,u.MaterialExpressionConstant3Vector,constant=u.LinearColor(.18,.24,.045,1)),u.MaterialProperty.MP_SUBSURFACE_COLOR)
    if name=='Glass':
        mat.set_editor_property('blend_mode',u.BlendMode.BLEND_TRANSLUCENT)
        output(mat,scalar(mat,.16),u.MaterialProperty.MP_OPACITY)
        output(mat,scalar(mat,1.03),u.MaterialProperty.MP_REFRACTION)
    if name=='Water':
        configure_water(mat,textures['WaterNormal'])
    if name=='Light':
        multiply=expression(mat,u.MaterialExpressionMultiply);connect(base,multiply,'A');connect(scalar(mat,300),multiply,'B');output(mat,multiply,u.MaterialProperty.MP_EMISSIVE_COLOR)
    lib.recompile_material(mat);eal.save_loaded_asset(mat);report['materials'].append(path)
configure_court_materials()
tree=u.load_asset(BASE+'/Scans/Fir/StaticMeshes/Fir')
for i,slot in enumerate(tree.get_editor_property('static_materials')):
    label=str(slot.get_editor_property('material_slot_name')).lower()
    tree.set_material(i,u.load_asset(BASE+'/Materials/M_'+('Needles' if 'needle' in label else 'Bark')))
eal.save_loaded_asset(tree)

worlds=u.get_editor_subsystem(u.LevelEditorSubsystem)
actors=u.get_editor_subsystem(u.EditorActorSubsystem)
def spawn(cls,name,position,rotation=u.Rotator()):
    actor=actors.spawn_actor_from_class(cls,u.Vector(*position),rotation);actor.set_actor_label(name);return actor
def light_component(actor):return actor.get_component_by_class(u.LightComponent)
for mode in ['TrainingHall','LakesideRide']:
    world=u.EditorLoadingAndSavingUtils.new_blank_map(False)
    outdoor=mode=='LakesideRide'
    sun=spawn(u.DirectionalLight,'Late afternoon sun',(0,0,3000),u.Rotator(pitch=-31,yaw=-38,roll=0))
    comp=light_component(sun);comp.set_editor_property('mobility',u.ComponentMobility.MOVABLE);comp.set_editor_property('intensity',60000 if outdoor else 1.7)
    comp.set_editor_property('light_color',u.Color(r=255,g=239,b=212,a=255))
    sun.set_actor_hidden_in_game(False);comp.set_visibility(True)
    comp.set_editor_property('affects_world',True)
    comp.set_editor_property('atmosphere_sun_light',True)
    comp.set_editor_property('dynamic_shadow_distance_movable_light',50000 if outdoor else 7000)
    dome=spawn(u.StaticMeshActor,'Atmospheric sky dome',(0,0,0))
    dc=dome.get_component_by_class(u.StaticMeshComponent)
    dc.set_static_mesh(u.load_asset('/Engine/BasicShapes/Sphere'))
    dc.set_material(0,u.load_asset(BASE+'/Materials/M_Sky' if outdoor else BASE+'/Materials/M_CourtSky'))
    dc.set_editor_property('cast_shadow',False)
    dc.set_collision_profile_name('NoCollision')
    dc.set_collision_enabled(u.CollisionEnabled.NO_COLLISION)
    dome.set_actor_scale3d(u.Vector(20000,20000,20000))
    ambient=spawn(u.SkyLight,'Ambient sky',(0,0,1000));sc=ambient.get_component_by_class(u.SkyLightComponent)
    sc.set_editor_property('mobility',u.ComponentMobility.MOVABLE)
    sc.set_editor_property('source_type',u.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
    sc.set_editor_property('cubemap',sky_cube)
    sc.set_editor_property('intensity',sky_scale*(.7 if outdoor else .002))
    sc.set_editor_property('real_time_capture',False)
    fog=spawn(u.ExponentialHeightFog,'Aerial depth',(0,0,0))
    fc=fog.get_component_by_class(u.ExponentialHeightFogComponent)
    fc.set_editor_property('fog_density',.002 if outdoor else 0.0)
    fc.set_editor_property('fog_height_falloff',.08)
    fc.set_editor_property('start_distance',5000)
    fc.set_fog_inscattering_color(u.LinearColor(1200,1600,2200,1))
    volume=spawn(u.PostProcessVolume,'Calibrated photographic exposure',(0,0,0))
    volume.set_editor_property('unbound',True)
    settings=volume.get_editor_property('settings')
    settings.set_editor_property('override_auto_exposure_method',True)
    settings.set_editor_property('auto_exposure_method',u.AutoExposureMethod.AEM_MANUAL)
    settings.set_editor_property('override_auto_exposure_bias',True)
    settings.set_editor_property('auto_exposure_bias',-13 if outdoor else -5.5)
    settings.set_editor_property('override_auto_exposure_apply_physical_camera_exposure',True)
    settings.set_editor_property('auto_exposure_apply_physical_camera_exposure',False)
    if not outdoor:
        settings.set_editor_property('override_ambient_occlusion_intensity',True)
        settings.set_editor_property('ambient_occlusion_intensity',1.)
        settings.set_editor_property('override_ambient_occlusion_radius',True)
        settings.set_editor_property('ambient_occlusion_radius',65.)
        settings.set_editor_property('override_bloom_intensity',True)
        settings.set_editor_property('bloom_intensity',.16)
    volume.set_editor_property('settings',settings)
    if not outdoor:
        for x in [-1200,0,1200]:
            for y in [-600,600]:
                lamp=spawn(u.RectLight,'Training light',(x,y,1020),u.Rotator(pitch=-90,yaw=0,roll=0))
                lc=light_component(lamp);lc.set_editor_property('mobility',u.ComponentMobility.MOVABLE)
                lc.set_editor_property('intensity_units',u.LightUnits.LUMENS);lc.set_editor_property('intensity',20500)
                lc.set_editor_property('use_temperature',True);lc.set_editor_property('temperature',5100.)
                lc.set_editor_property('source_width',300);lc.set_editor_property('source_height',110)
                lc.set_editor_property('attenuation_radius',2600);lc.set_editor_property('cast_shadows',x==-1200 and y==-600)
    spawn(u.PlayerStart,'Athlete start',(400,0,96) if not outdoor else (0,0,1905))
    scene=spawn(u.SportsWorld,'Memory Palace sports environment',(0,0,0))
    scene.set_editor_property('cycling',outdoor);scene.build_scene()
    if outdoor:
        route=json.load(open(os.path.join(ROOT,'Content/Data/environment.json'),encoding='utf-8'))
        def route_pose(distance):
            coordinate=distance/route['length']*(len(route['route'])-1)
            index=min(int(coordinate),len(route['route'])-2);mix=coordinate-index
            a=route['route'][index]['p'];b=route['route'][index+1]['p']
            p=u.Vector(*(a[k]+(b[k]-a[k])*mix for k in range(3)))
            yaw=math.degrees(math.atan2(b[1]-a[1],b[0]-a[0]))
            return p,yaw
        def sign_box(label,position,scale,yaw,material):
            actor=spawn(u.StaticMeshActor,label,(position.x,position.y,position.z),u.Rotator(yaw=yaw))
            component=actor.get_component_by_class(u.StaticMeshComponent)
            component.set_static_mesh(u.load_asset('/Engine/BasicShapes/Cube'));component.set_material(0,u.load_asset(BASE+'/Materials/M_'+material))
            component.set_collision_profile_name('NoCollision');component.set_editor_property('cast_shadow',True)
            actor.set_actor_scale3d(u.Vector(*scale))
        for distance,label in [(15,'START / 3.53 KM'),(route['length']-15,'FINISH / R: NEW RIDE')]:
            p,yaw=route_pose(distance);angle=math.radians(yaw);side=u.Vector(-math.sin(angle),math.cos(angle),0);forward=u.Vector(math.cos(angle),math.sin(angle),0)
            for direction in [-1,1]:sign_box('Course gate support',p+side*direction*420+u.Vector(0,0,170),(.14,.14,3.4),yaw,'Steel')
            sign_box('Course gate board',p+u.Vector(0,0,330),(.16,8.6,.74),yaw,'Padding')
            text_position=p-forward*10+u.Vector(0,0,330)
            text=spawn(u.TextRenderActor,'Course marker: '+label,(text_position.x,text_position.y,text_position.z),u.Rotator(yaw=yaw+180))
            tc=text.get_component_by_class(u.TextRenderComponent);tc.set_text(label);tc.set_world_size(30)
            tc.set_horizontal_alignment(u.HorizTextAligment.EHTA_CENTER);tc.set_vertical_alignment(u.VerticalTextAligment.EVRTA_TEXT_CENTER)
            tc.set_text_render_color(u.Color(r=218,g=237,b=193,a=255))
    if not u.EditorLoadingAndSavingUtils.save_map(world,'/Game/MemorySports/Maps/'+mode):
        raise RuntimeError('地图保存失败：'+mode)
    report['maps'].append('/Game/MemorySports/Maps/'+mode)
eal.save_directory(BASE,only_if_is_dirty=True,recursive=True)
with open(os.path.join(ROOT,'Reports','asset-build.json'),'w',encoding='utf-8') as f:json.dump(report,f,indent=2)
u.log('MEMORY_SPORTS_ASSETS_READY '+json.dumps(report))
