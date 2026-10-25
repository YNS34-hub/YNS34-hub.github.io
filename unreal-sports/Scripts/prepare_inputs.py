"""仅从已授权的中立公开素材生成原生输入；不读取私人媒体。"""
from pathlib import Path
import json, math, struct, random
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "InputAssets"
FOREST = Path(r"C:\Users\86135\Documents\Codex\2026-10-04\the-memory-palace-stop-building-a\work\palace\public\media\road\forest")
OUT.mkdir(exist_ok=True)
random.seed(734)
for source in FOREST.glob("fir_tree_01-*.webp"):
    Image.open(source).save(OUT / (source.stem + ".png"))

def noise_texture(name, base, strength, size=512):
    noise=Image.effect_noise((size,size),40).convert("L")
    image=Image.new("RGB",noise.size)
    image.putdata([tuple(max(0,min(255,int(c+(v-128)*strength))) for c in base) for v in noise.getdata()])
    image.save(OUT/(name+".png"))

noise_texture("Asphalt",(43,48,48),.18)
noise_texture("Meadow",(77,91,48),.24)
noise_texture("Rock",(100,105,102),.26)
size=1024
wood=Image.new("RGB",(size,size)); wp=wood.load()
for y in range(size):
    board=y//128
    tone=[0,-8,7,-3,12,-5,4,-9][board]
    for x in range(size):
        seam=y%128<2 or (x+(board%3)*319)%1024<2
        grain=math.sin(y*.9+math.sin(x*.018+board)*1.8)*2+math.sin(y*.22+x*.004)*3+random.uniform(-2,2)
        value=tone+grain
        wp[x,y]=(100,74,45) if seam else tuple(int(c+value) for c in (184,137,79))
wood.save(OUT/"Wood.png")
ball=Image.new("RGB",(1024,512)); bp=ball.load()
for y in range(512):
    latitude=(y/511-.5)*math.pi
    for x in range(1024):
        longitude=x/1024*2*math.pi
        n=(math.cos(latitude)*math.cos(longitude),math.cos(latitude)*math.sin(longitude),math.sin(latitude))
        seam=min(abs(n[0]),abs(n[1]),abs(n[2]),abs(n[0]*.71+n[2]*.71))<.018
        pebble=((x%6-3)**2+(y%6-3)**2)<4
        bp[x,y]=(28,24,19) if seam else tuple(int(c+random.uniform(-7,7)+(8 if pebble else -3)) for c in (174,78,27))
ball.save(OUT/"Ball.png")
from water_normals import write_water_normal
write_water_normal(OUT/"WaterNormal.png")
from court_surface_normals import write_surface_normals
write_surface_normals(OUT)

def gltf(name, parts, materials, images=None):
    buffer=bytearray(); views=[]; accessors=[]; primitives=[]
    def data(values, fmt, kind, components):
        while len(buffer)%4: buffer.append(0)
        offset=len(buffer); buffer.extend(struct.pack("<"+fmt*len(values),*values))
        views.append({"buffer":0,"byteOffset":offset,"byteLength":len(buffer)-offset})
        item={"bufferView":len(views)-1,"componentType":5126 if fmt=="f" else 5125,"count":len(values)//components,"type":kind}
        if kind=="VEC3":
            item["min"]=[min(values[i::3]) for i in range(3)];item["max"]=[max(values[i::3]) for i in range(3)]
        accessors.append(item);return len(accessors)-1
    for part in parts:
        p={"attributes":{"POSITION":data(part["position"],"f","VEC3",3),"NORMAL":data(part["normal"],"f","VEC3",3),"TEXCOORD_0":data(part["uv"],"f","VEC2",2)},"indices":data(part["index"],"I","SCALAR",1),"material":part.get("material",0)}
        primitives.append(p)
    doc={"asset":{"version":"2.0","generator":"Memory Palace local public-asset conversion"},"buffers":[{"uri":name+".bin","byteLength":len(buffer)}],"bufferViews":views,"accessors":accessors,"meshes":[{"name":name,"primitives":primitives}],"nodes":[{"mesh":0,"name":name}],"scenes":[{"nodes":[0]}],"scene":0,"materials":materials}
    if images:
        doc["images"]=[{"uri":file} for file in images];doc["textures"]=[{"source":i} for i in range(len(images))]
    (OUT/(name+".bin")).write_bytes(buffer);(OUT/(name+".gltf")).write_text(json.dumps(doc),encoding="utf-8")

environment=json.loads((ROOT/"Content/Data/environment.json").read_text())
parts=environment["trees"][0]["parts"]
for part in parts:part["material"]=1 if part["leaf"] else 0
gltf("Fir",parts,[{"name":"Bark","pbrMetallicRoughness":{"baseColorTexture":{"index":0},"roughnessFactor":.94,"metallicFactor":0},"normalTexture":{"index":1}}, {"name":"Needles","doubleSided":True,"alphaMode":"MASK","alphaCutoff":.42,"pbrMetallicRoughness":{"baseColorTexture":{"index":2},"roughnessFactor":.87,"metallicFactor":0},"normalTexture":{"index":3}}], ["fir_tree_01-bark-color.png","fir_tree_01-bark-normal.png","fir_tree_01-twig-color.png","fir_tree_01-twig-normal.png"])
# 轮胎用有空心轮廓的环面，实际比例为 700C，禁止用实心圆盘代替。
wheel={"position":[],"normal":[],"uv":[],"index":[]}
for i in range(65):
    a=i/64*2*math.pi
    for j in range(9):
        b=j/8*2*math.pi;r=.326+.014*math.cos(b)
        wheel["position"].extend([r*math.cos(a),.014*math.sin(b),r*math.sin(a)])
        wheel["normal"].extend([math.cos(b)*math.cos(a),math.sin(b),math.cos(b)*math.sin(a)])
        wheel["uv"].extend([i/64,j/8])
        if i<64 and j<8:
            v=i*9+j;wheel["index"].extend([v,v+9,v+1,v+1,v+9,v+10])
gltf("Wheel",[wheel],[{"name":"Tire","pbrMetallicRoughness":{"baseColorFactor":[.015,.02,.022,1],"roughnessFactor":.7,"metallicFactor":0}}])
print("Prepared neutral forest, original material data and 700C tire geometry.")
