from PIL import Image, ImageDraw, ImageFilter
import numpy as np, math, wave
from pathlib import Path
ROOT=Path(__file__).resolve().parent
ROOT.mkdir(exist_ok=True,parents=True)
W,H=1920,1080
x=np.linspace(-1,1,W)[None,:]
y=np.linspace(-1,1,H)[:,None]
rng=np.random.default_rng(3401)
def save(name,a):
    a=np.clip(a,0,255).astype('uint8');Image.fromarray(a).save(ROOT/(name+'.webp'),quality=89,method=6)
def render_arch(name,night=False,side=False):
    w,h=1280,720
    cam=np.array([5.6,2.4,9.] if side else [0.,2.6,10.])
    target=np.array([-1.,3.,-17.] if side else [0.,3.1,-30.])
    f=(target-cam);f/=np.linalg.norm(f)
    r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f)
    sx,sy=np.meshgrid(np.linspace(-1,1,w)*1.72,np.linspace(.97,-.97,h))
    rd=f[None,None,:]+sx[:,:,None]*r*.46+sy[:,:,None]*u*.46
    rd=rd/np.linalg.norm(rd,axis=2)[:,:,None]
    ro=np.broadcast_to(cam,(h,w,3));inv=1/np.where(np.abs(rd)<1e-8,1e-8,rd)
    boxes=[]
    floor=(np.array([-.01]*3))
    def box(mn,mx,col):boxes.append((np.array(mn,float),np.array(mx,float),np.array(col,float)))
    pale=[.82,.83,.815] if not night else [.055,.066,.07]
    box([-22,-.25,-90],[22,0,20],[.74,.77,.78] if not night else [.05,.065,.075])
    box([-9,0,-90],[-8.65,12,16],pale);box([8.65,0,-90],[9,12,16],pale)
    for z in np.arange(6,-76,-7):
        for xx in [-6.2,6.2]:box([xx-.32,0,z-.28],[xx+.32,11,z+.28],pale)
        for xx in [-6,6]:box([xx-2.65,10.7,z-.4],[xx+2.65,11,z+.4],pale)
        if side:box([-8.7,0,z-3.0],[-7.9,10,z-2.8],pale)
    # A large rear aperture, illuminated by the sky rather than a flat illustration.
    box([-8.6,0,-67],[-3,11,-66.7],pale);box([3,0,-67],[8.6,11,-66.7],pale)
    box([-3,8,-67],[3,11,-66.7],pale)
    dist=np.full((h,w),1e10);mat=np.zeros((h,w,3));normal=np.zeros((h,w,3))
    for mn,mx,col in boxes:
        t1=(mn-ro)*inv;t2=(mx-ro)*inv
        tn=np.max(np.minimum(t1,t2),axis=2);tf=np.min(np.maximum(t1,t2),axis=2)
        valid=(tf>=np.maximum(tn,0))&(tn<dist)&(tn>.005)
        hit=ro+rd*tn[:,:,None]
        delta=np.minimum(np.abs(hit-mn),np.abs(hit-mx));axis=np.argmin(delta,axis=2)
        n=np.zeros((h,w,3));
        for aa in range(3):n[:,:,aa]=np.where(axis==aa,np.where(np.abs(hit[:,:,aa]-mn[aa])<np.abs(hit[:,:,aa]-mx[aa]),-1,1),0)
        dist=np.where(valid,tn,dist);mat=np.where(valid[:,:,None],col,mat);normal=np.where(valid[:,:,None],n,normal)
    hit=ro+rd*dist[:,:,None]
    ld=np.array([-.52,.88,.18]);ld/=np.linalg.norm(ld)
    shadow=np.ones((h,w));sho=hit+normal*.003;si=1/ld
    for mn,mx,col in boxes:
        t1=(mn-sho)*si;t2=(mx-sho)*si
        tn=np.max(np.minimum(t1,t2),axis=2);tf=np.min(np.maximum(t1,t2),axis=2)
        shadow=np.minimum(shadow,np.where((tf>=np.maximum(tn,.01))&(tn>.01),.27,1.))
    sun=np.maximum(np.sum(normal*ld,axis=2),0)
    ao=np.clip(.67+.33*np.minimum(np.abs(hit[:,:,1])*.2,1),.64,1)
    light=(.44+.9*sun*shadow)*ao
    color=mat*light[:,:,None]
    sky=np.empty((h,w,3));sky[:]=[.66,.79,.9] if not night else [.055,.105,.165]
    sy=np.clip(rd[:,:,1],-.4,.7)
    sky+=sy[:,:,None]*np.array([.25,.16,.07] if not night else [.005,.015,.03])
    fog=np.clip(dist/160,0,.45)[:,:,None]
    color=color*(1-fog)+sky*fog
    color=np.where((dist>1e9)[:,:,None],sky,color)
    # Soft reflected blue light, without a mirror floor.
    isfloor=normal[:,:,1]>.9
    color+=isfloor[:,:,None]*np.array([.005,.017,.027])*(.4+.6*np.exp(-np.abs(hit[:,:,0])*.23))[:,:,None]
    color=np.clip(color,0,1)**(1/1.45)
    arr=(color*255).astype('uint8')
    im=Image.fromarray(arr).resize((W,H),Image.Resampling.LANCZOS)
    im.save(ROOT/(name+'.webp'),quality=90,method=6)
render_arch('threshold')
render_arch('colonnade',side=True)
# Scalar-field art: luminous contour sets with a blue floor of atmosphere.
xx=np.broadcast_to(x,(H,W));yy=np.broadcast_to(y,(H,W))
f=np.sqrt(((xx+.15)*1.05)**2+((yy+.1)*.9)**2)+.07*np.sin(xx*6+yy*3)+.025*np.cos(yy*11)
phase=np.abs(np.sin(f*math.pi*24))
lines=np.exp(-phase*phase/0.007)
halo=np.exp(-phase*phase/.05)
v=np.clip((f-.15)/1.7,0,1)
base=np.array([190,215,229])[None,None,:]*(1-v[:,:,None])+np.array([67,118,149])[None,None,:]*v[:,:,None]
base+=lines[:,:,None]*np.array([48,36,26])+halo[:,:,None]*6
base+=np.exp(-((xx-.22)**2+(yy+.3)**2)*1.5)[:,:,None]*10
save('level-sets',base)
# Parametric terrain: gently overlapping ice-blue mathematical horizons.
base=np.ones((H,W,3))*np.array([219,231,235]);base+=yy[:,:,None]*np.array([-12,-5,0])
for i in range(21):
    horizon=-.5+i*.074+.09*np.sin(xx*2.4+i*.18)+.02*np.sin(xx*8+i*.7)
    yy2=np.broadcast_to(yy,(H,W));mix=np.clip((yy2-horizon)*250,0,1)[:,:,None]
    col=np.array([147-i*2.25,181-i*1.5,202-i*.9])
    base=base*(1-mix)+col[None,None,:]*mix
    highlight=np.exp(-((yy2-horizon)*160)**2)[:,:,None]
    base+=highlight*np.array([15,19,22])
save('blue-hour',base)
# Night interior/window: an architectural composition with restrained water reflections.
im=Image.new('RGB',(W,H),(18,26,31));d=ImageDraw.Draw(im)
for py in range(H):
    q=py/H;d.line([(0,py),(W,py)],fill=(int(18+q*9),int(28+q*9),int(39+q*8)))
# Luminous aperture and distant horizon.
d.rectangle((280,155,1640,745),fill=(37,61,80))
for py in range(155,745):
    q=(py-155)/590;d.line([(280,py),(1640,py)],fill=(int(37+q*9),int(61+q*16),int(80+q*20)))
for k in range(22):
    px=330+k*60;ht=65+int(45*np.sin(k*1.7)+20*np.cos(k*.3))
    d.rectangle((px,625-ht,px+int(20+10*np.sin(k)),641),fill=(33,50,62))
    if k%3==0:d.rectangle((px+4,635-ht,px+6,640-ht),fill=(145,143,122))
d.rectangle((280,641,1640,744),fill=(26,46,63))
for k in range(48):
    py=647+k*2;size=12+k*5
    px=1030+int(np.sin(k*1.9)*35);d.line([(px-size,py),(px+size,py)],fill=(45+k//5,68+k//5,82+k//5),width=1)
d.rectangle((262,136,282,763),fill=(14,21,25));d.rectangle((1638,136,1658,763),fill=(14,21,25))
d.rectangle((262,136,1658,158),fill=(14,21,25));d.rectangle((262,744,1658,763),fill=(14,21,25))
d.rectangle((953,151,964,746),fill=(17,26,32))
# Minimal plinth, blue reflection and a warm line of floor light.
d.polygon([(750,884),(1380,866),(1520,905),(835,930)],fill=(22,28,31))
d.polygon([(750,848),(1380,828),(1380,866),(750,884)],fill=(31,37,39))
d.polygon([(750,848),(1380,828),(1518,867),(892,893)],fill=(47,48,45))
d.line([(181,948),(601,900)],fill=(124,112,93),width=3)
im.save(ROOT/'nocturne.webp',quality=90,method=6)
# An explicitly original, non-vocal ambient study. No sampled/copyrighted recordings.
sr=22050;seconds=36;t=np.arange(sr*seconds)/sr
fade=np.sin(np.pi*np.clip(t/seconds,0,1))**1.2
sound=np.zeros_like(t)
for i,freq in enumerate([110,164.8138,220,261.6256,329.6276]):
    phase=.12*np.sin(2*np.pi*.045*t+i)
    env=.38+.22*np.sin(2*np.pi*.027*t+i*.8)
    sound+=np.sin(2*np.pi*freq*t+phase)*env/(8+i*2)
    sound+=np.sin(2*np.pi*freq*2*t+phase)*.012
sound*=fade*.62
stereo=np.stack([sound,np.roll(sound,145)*.96],axis=1)
with wave.open(str(ROOT/'palace-study.wav'),'wb') as out:
    out.setnchannels(2);out.setsampwidth(2);out.setframerate(sr);out.writeframes((stereo*32767).astype('<i2').tobytes())
print([(p.name,round(p.stat().st_size/1024)) for p in ROOT.iterdir()])

# Locally generated OpenGraph poster.
poster=Image.open(ROOT/'threshold.webp').convert('RGB').resize((1200,675))
draw=ImageDraw.Draw(poster)
font_path=ROOT.parents[1]/'assets/nimbus-sans-regular.otf'
font=ImageFont.truetype(str(font_path),41)
small=ImageFont.truetype(str(font_path),16)
draw.rectangle((0,0,1200,156),fill=(232,236,233))
draw.text((55,44),'THE MEMORY PALACE',font=font,fill=(38,51,54))
draw.text((58,106),'JIE TIAN   /   PROJECTS · RESEARCH · MUSIC · IMAGES · EXPERIMENTS',font=small,fill=(85,106,115))
poster.save(ROOT/'og-palace.png',optimize=True)
