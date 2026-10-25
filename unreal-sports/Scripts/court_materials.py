"""球馆专用表面：真实尺度地板、球皮法线和独立室内窗外亮度。"""
import unreal as u


def configure_court_materials():
    lib, assets = u.MaterialEditingLibrary, u.EditorAssetLibrary
    tools = u.AssetToolsHelpers.get_asset_tools()
    base = '/Game/MemorySports'
    def make(name):
        mat = u.load_asset(base + '/Materials/M_' + name) or tools.create_asset(
            'M_' + name, base + '/Materials', u.Material, u.MaterialFactoryNew())
        for old in list(lib.get_material_expressions(mat)):
            lib.delete_material_expression(mat, old)
        lib.set_material_usage(mat, u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES)
        return mat
    def node(mat, kind, **properties):
        result = lib.create_material_expression(mat, kind)
        for key, value in properties.items():
            result.set_editor_property(key, value)
        return result
    def constant(mat, value):
        return node(mat, u.MaterialExpressionConstant, r=value)
    def color(mat, value):
        return node(mat, u.MaterialExpressionConstant3Vector, constant=u.LinearColor(*value, 1))
    def link(source, target, slot, output=''):
        assert lib.connect_material_expressions(source, output, target, slot)
    def out(mat, source, property):
        assert lib.connect_material_property(source, '', property)
    def save(mat):
        lib.recompile_material(mat)
        assert assets.save_loaded_asset(mat)
    wood = make('Wood')
    position = node(wood, u.MaterialExpressionWorldPosition)
    xy = node(wood, u.MaterialExpressionComponentMask, r=True, g=True)
    link(position, xy, '')
    uv = node(wood, u.MaterialExpressionMultiply)
    link(xy, uv, 'A')
    link(node(wood, u.MaterialExpressionConstant2Vector, r=1 / 180., g=1 / 52.), uv, 'B')
    # 8 排木条对应 52 cm，单条约 6.5 cm，消除原来过宽的塑料条纹感。
    texture = node(wood, u.MaterialExpressionTextureSample, texture=u.load_asset(base + '/Textures/Wood'))
    link(uv, texture, 'UVs')
    subtle = node(wood, u.MaterialExpressionLinearInterpolate)
    link(texture, subtle, 'A'); link(color(wood, (.48, .31, .145)), subtle, 'B')
    link(constant(wood, .42), subtle, 'Alpha')
    out(wood, subtle, u.MaterialProperty.MP_BASE_COLOR)
    out(wood, constant(wood, .4), u.MaterialProperty.MP_ROUGHNESS)
    out(wood, constant(wood, .28), u.MaterialProperty.MP_SPECULAR)
    normal = node(wood, u.MaterialExpressionTextureSample,
                  texture=u.load_asset(base + '/Textures/CourtWoodNormal'),
                  sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL)
    link(uv, normal, 'UVs'); out(wood, normal, u.MaterialProperty.MP_NORMAL)
    wood.set_editor_property('tangent_space_normal', False)
    save(wood)
    ball = make('Ball')
    diffuse = node(ball, u.MaterialExpressionTextureSample, texture=u.load_asset(base + '/Textures/Ball'))
    out(ball, diffuse, u.MaterialProperty.MP_BASE_COLOR)
    out(ball, constant(ball, .7), u.MaterialProperty.MP_ROUGHNESS)
    out(ball, constant(ball, .22), u.MaterialProperty.MP_SPECULAR)
    normal = node(ball, u.MaterialExpressionTextureSample,
                  texture=u.load_asset(base + '/Textures/BallNormal'),
                  sampler_type=u.MaterialSamplerType.SAMPLERTYPE_NORMAL)
    out(ball, normal, u.MaterialProperty.MP_NORMAL)
    save(ball)
    sky = make('CourtSky')
    sky.set_editor_property('shading_model', u.MaterialShadingModel.MSM_UNLIT)
    sky.set_editor_property('two_sided', True)
    sample = node(sky, u.MaterialExpressionTextureSample, texture=u.load_asset(base + '/Textures/SkyPhoto'))
    brightness = node(sky, u.MaterialExpressionMultiply)
    link(sample, brightness, 'A'); link(constant(sky, 40.), brightness, 'B')
    out(sky, brightness, u.MaterialProperty.MP_EMISSIVE_COLOR)
    save(sky)
    return ['Wood', 'Ball', 'CourtSky']
