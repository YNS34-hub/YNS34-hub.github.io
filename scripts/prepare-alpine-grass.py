"""Prepare three complete CC0 photographed grass clumps for offline LOD generation."""
import json
import os
import urllib.request
import tempfile
from pathlib import Path
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
CACHE=Path(os.environ.get("PALACE_ALPINE_CACHE",str(Path(tempfile.gettempdir())/"palace-alpine-source")))
CACHE.mkdir(parents=True,exist_ok=True)
DEST=ROOT/"public/media/alpine/grass_medium_01"
DEST.mkdir(exist_ok=True)
headers={"User-Agent":"Mozilla/5.0","Referer":"https://polyhaven.com/"}
def cached(name,url):
    file=CACHE/name
    if not file.exists():
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=60) as r:file.write_bytes(r.read())
    return file
data=json.loads(cached("grass_medium_01.json","https://api.polyhaven.com/files/grass_medium_01").read_text())
entry=data["gltf"]["1k"]["gltf"]
gltf=json.loads(cached("grass.gltf",entry["url"]).read_text())
binary=cached("grass-original.bin",entry["include"]["grass_medium_01.bin"]["url"]).read_bytes()
packed=bytearray();views=[];accessors=[];meshes=[]
for mesh in [gltf["meshes"][i] for i in [0,6,8]]:
    primitive=mesh["primitives"][0];remap={}
    for old in [*primitive["attributes"].values(),primitive["indices"]]:
        a=gltf["accessors"][old];view=gltf["bufferViews"][a["bufferView"]]
        size={5123:2,5125:4,5126:4}[a["componentType"]]*{"SCALAR":1,"VEC2":2,"VEC3":3}[a["type"]]*a["count"]
        offset=view.get("byteOffset",0)+a.get("byteOffset",0)
        while len(packed)%4:packed.append(0)
        remap[old]=len(accessors)
        views.append({"buffer":0,"byteOffset":len(packed),"byteLength":size,"target":view["target"]})
        accessors.append({**a,"bufferView":len(views)-1,"byteOffset":0})
        packed.extend(binary[offset:offset+size])
    meshes.append({"primitives":[{"attributes":{k:remap[v] for k,v in primitive["attributes"].items()},"indices":remap[primitive["indices"]],"material":0}]})
gltf["meshes"]=meshes;gltf["nodes"]=[{"mesh":i} for i in range(len(meshes))];gltf["scenes"]=[{"nodes":list(range(len(meshes)))}]
gltf["accessors"]=accessors;gltf["bufferViews"]=views;gltf["buffers"]=[{"byteLength":len(packed),"uri":"source.bin"}]
diff=cached("grass-diff.jpg",data["Diffuse"]["1k"]["jpg"]["url"])
alpha=cached("grass-alpha.png",data["Alpha"]["1k"]["png"]["url"])
image=Image.open(diff).convert("RGBA");image.putalpha(Image.open(alpha).convert("L"));image.save(DEST/"leaves.webp","WEBP",quality=93)
# 草簇照片单独打包，留足透明边带；不从相邻 UV 岛上裁出半截叶片。
atlas=Image.new("RGBA",(512,512))
for i,box in enumerate([(175,785,424,916),(611,787,813,910),(240,920,425,1023)]):
    patch=image.crop(box);patch.thumbnail((236,236),Image.Resampling.LANCZOS)
    tile=Image.new("RGBA",(256,256));tile.alpha_composite(patch,((256-patch.width)//2,256-patch.height))
    # 根部与地表柔和衔接，透明边缘补色防止 mipmap 产生黑色矩形或黑边。
    a=tile.getchannel("A");pix=a.load()
    for y in range(256):
        for x in range(256):pix[x,y]=round(pix[x,y]*min(1,(255-y)/12))
    rgb=tile.convert("RGB");bleed=rgb.filter(ImageFilter.MaxFilter(5));rgb.paste(bleed,mask=a.point(lambda n:255-n));tile=rgb.convert("RGBA");tile.putalpha(a)
    atlas.alpha_composite(tile,((i%2)*256,(i//2)*256))
atlas.save(DEST/"clumps.webp","WEBP",quality=94)
normal=cached("grass-normal.jpg",entry["include"]["textures/grass_medium_01_nor_gl_1k.jpg"]["url"])
Image.open(normal).save(DEST/"normal.webp","WEBP",quality=93)
gltf["images"]=[{"uri":"normal.webp","mimeType":"image/webp"},{"uri":"leaves.webp","mimeType":"image/webp"}]
gltf["textures"]=gltf["textures"][:2]
gltf["materials"][0]={"doubleSided":True,"alphaMode":"MASK","alphaCutoff":.45,"normalTexture":{"index":0},"pbrMetallicRoughness":{"baseColorTexture":{"index":1},"metallicFactor":0,"roughnessFactor":.9}}
(DEST/"source.bin").write_bytes(packed);(DEST/"source.gltf").write_text(json.dumps(gltf,separators=(",",":")),encoding="utf8")
print("three photographed grass clumps,",len(packed),"source geometry bytes",flush=True)
