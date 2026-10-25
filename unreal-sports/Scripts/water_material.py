"""只配置湖水材质；全场景重建与单材质修整共用，避免下一次生成退回旧波纹。"""
import unreal as u

def configure_water(mat, texture):
    lib=u.MaterialEditingLibrary
    for old in list(lib.get_material_expressions(mat)):
        lib.delete_material_expression(mat,old)
    def node(cls,**properties):
        value=lib.create_material_expression(mat,cls)
        for key,item in properties.items():value.set_editor_property(key,item)
        return value
    def link(a,b,slot):
        assert lib.connect_material_expressions(a,'',b,slot), slot
    def scalar(value):return node(u.MaterialExpressionConstant,r=float(value))
    def color(*values):return node(u.MaterialExpressionConstant3Vector,constant=u.LinearColor(*values,1))
    def op(cls,a,b):
        value=node(cls);link(a,value,'A');link(b,value,'B');return value
    def out(value,prop):assert lib.connect_material_property(value,'',prop)
    def lerp(a,b,alpha):
        value=node(u.MaterialExpressionLinearInterpolate)
        link(a,value,'A');link(b,value,'B');link(alpha,value,'Alpha');return value
    mat.set_editor_property('blend_mode',u.BlendMode.BLEND_TRANSLUCENT)
    mat.set_editor_property('two_sided',True)
    mat.set_editor_property('translucency_lighting_mode',u.TranslucencyLightingMode.TLM_SURFACE_PER_PIXEL_LIGHTING)
    lib.set_material_usage(mat,u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES)
    position=node(u.MaterialExpressionWorldPosition)
    xy=node(u.MaterialExpressionComponentMask,r=True,g=True);link(position,xy,'')
    uv1=op(u.MaterialExpressionMultiply,xy,scalar(1/3200))
    # 第二层旋转 37 度，并使用不同尺度和流向，消除同相位反射的整齐网格。
    uv2=op(u.MaterialExpressionMultiply,xy,scalar(1/850))
    rx=op(u.MaterialExpressionDotProduct,uv2,node(u.MaterialExpressionConstant2Vector,r=.8,g=.6))
    ry=op(u.MaterialExpressionDotProduct,uv2,node(u.MaterialExpressionConstant2Vector,r=-.6,g=.8))
    rotated=op(u.MaterialExpressionAppendVector,rx,ry)
    normals=[]
    for uv,sx,sy in [(uv1,.014,.009),(rotated,-.021,.013)]:
        panner=node(u.MaterialExpressionPanner,speed_x=sx,speed_y=sy)
        link(uv,panner,'Coordinate')
        sample=node(u.MaterialExpressionTextureSample,texture=texture,sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        link(panner,sample,'UVs');normals.append(sample)
    blended=lerp(lerp(normals[0],normals[1],scalar(.35)),color(0,0,1),scalar(.18))
    normalized=node(u.MaterialExpressionNormalize);link(blended,normalized,'')
    out(normalized,u.MaterialProperty.MP_NORMAL)
    fade=node(u.MaterialExpressionDepthFade,fade_distance_default=400,opacity_default=1)
    out(lerp(color(.046,.12,.103),color(.015,.065,.072),fade),u.MaterialProperty.MP_BASE_COLOR)
    out(scalar(.24),u.MaterialProperty.MP_ROUGHNESS)
    out(scalar(0),u.MaterialProperty.MP_METALLIC)
    out(scalar(.25),u.MaterialProperty.MP_SPECULAR)
    uv=node(u.MaterialExpressionTextureCoordinate)
    centered=op(u.MaterialExpressionSubtract,uv,node(u.MaterialExpressionConstant2Vector,r=.5,g=.5))
    radius=op(u.MaterialExpressionMultiply,op(u.MaterialExpressionDotProduct,centered,centered),scalar(4))
    edge=node(u.MaterialExpressionOneMinus);link(radius,edge,'')
    coast=node(u.MaterialExpressionSaturate);link(op(u.MaterialExpressionMultiply,edge,scalar(10)),coast,'')
    out(op(u.MaterialExpressionMultiply,op(u.MaterialExpressionMultiply,fade,scalar(.76)),coast),u.MaterialProperty.MP_OPACITY)
    lib.layout_material_expressions(mat)
    lib.recompile_material(mat)
    u.EditorAssetLibrary.save_loaded_asset(mat)
