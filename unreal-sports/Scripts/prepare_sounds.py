"""生成原创、低音量的运动反馈音；不读取个人音乐或录音。"""
from pathlib import Path
import wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'InputAssets';rate=22050;rng=np.random.default_rng(734)
def save(name,signal):
    with wave.open(str(OUT/(name+'.wav')),'wb') as file:
        file.setparams((1,2,rate,0,'NONE','not compressed'))
        file.writeframes((np.clip(signal,-.8,.8)*32767).astype('<i2').tobytes())
t=np.arange(int(rate*.22))/rate
bounce=(.37*np.sin(2*np.pi*(96*t+18*t*np.exp(-t*18)))+.15*np.sin(2*np.pi*190*t))*np.exp(-t*20)
bounce+=rng.normal(0,.08,len(t))*np.exp(-t*120)
save('Bounce',bounce)
t=np.arange(int(rate*.38))/rate
rim=sum(.12*np.sin(2*np.pi*f*t)*np.exp(-t*d) for f,d in [(980,10),(1747,8),(2741,14),(4180,18)])
save('Rim',rim)
t=np.arange(int(rate*.25))/rate
swish=np.convolve(rng.normal(0,.35,len(t)),np.ones(7)/7,'same')*np.sin(np.pi*t/.25)**2
save('Swish',swish)
t=np.arange(int(rate*.07))/rate
save('Shift',(.14*np.sin(2*np.pi*1340*t)+rng.normal(0,.06,len(t)))*np.exp(-t*70))
wind=np.convolve(rng.normal(0,.22,rate*4),np.ones(25)/25,'same')
fade=np.linspace(0,1,2205);seam=wind[-2205:]*(1-fade)+wind[:2205]*fade
wind[:2205]=seam;wind[-2205:]=seam
save('RideWind',wind)
print('Generated five original PCM sound effects.')
