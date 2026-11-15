import numpy as np,scipy.io.wavfile as wf,json,subprocess
from scipy.signal import butter,sosfilt
SR=48000;TOTAL=82.4;N=int(TOTAL*SR);CRT0=80.3
rs=np.random.RandomState(11)
def rd(f):
    sr,a=wf.read(f);a=a.astype(np.float32)/32768;return a if a.ndim==1 else a.mean(1)
M=rd('main.wav');AL=rd('ali.wav');WH=rd('whisper.wav');HK=rd('hook.wav')
def sl(x,a,b):return x[int(a*SR):int(b*SR)].copy()
def fade(x,fi=.01,fo=.02):
    i=int(fi*SR);o=int(fo*SR);x[:i]*=np.linspace(0,1,i);x[-o:]*=np.linspace(1,0,o);return x
def bp(x,lo,hi,o=4):return sosfilt(butter(o,[lo,hi],'band',fs=SR,output='sos'),x).astype(np.float32)
def lp_(x,f,o=4):return sosfilt(butter(o,f,'low',fs=SR,output='sos'),x).astype(np.float32)
def hp_(x,f,o=4):return sosfilt(butter(o,f,'high',fs=SR,output='sos'),x).astype(np.float32)
def Tt(n):return np.arange(n)/SR
def noise(n):return rs.randn(n).astype(np.float32)
def radio_fx(x,seed,noise_lv=.02):
    r=np.random.RandomState(seed);y=bp(x,400,3400)
    y=np.tanh(y*(5/(np.max(np.abs(y))+1e-6)));t=Tt(len(y));y*=(1+.1*np.sin(2*np.pi*6.5*t))
    n=bp(r.randn(len(y)).astype(np.float32),1200,7000,2);bur=np.abs(lp_(r.randn(len(y)).astype(np.float32),14,1))>.35
    return (y+noise_lv*n*(.4+1.8*bur)).astype(np.float32)
# ------------- voice placements (new timeline) -------------
trk={k:np.zeros(N,dtype=np.float32) for k in ['nar','radio','ali','hook','whis']}
POS={}
def put(track,src,ra,rb,ns,name):
    seg=fade(sl(src,ra-.06,rb+.15));s0=int((ns-.06)*SR);trk[track][s0:s0+len(seg)]+=seg;POS[name]=(ns,ns+(rb-ra))
def putm(track,src,rawlist,ns,name):  # contiguous raw
    pass
# hook
put('hook',HK,.73,3.10,1.30,'H1');put('hook',HK,4.17,5.55,4.67,'H2')
# radio R1 (segs 1-2 contiguous)
put('radio',M,1.12,7.38,6.75,'R1')
# narrator
put('nar',M,8.72,11.25,13.70,'N1')
put('nar',M,12.10,15.07,16.95,'N2a');put('nar',M,15.66,17.74,20.40,'N2b');put('nar',M,18.69,21.84,22.90,'N2c')
put('nar',M,23.43,26.27,26.70,'N3')
put('ali',AL,.36,11.85,30.60,'ALI1');put('ali',AL,12.98,16.56,42.75,'ALI2')
put('nar',M,29.97,33.05,47.10,'N4a');put('nar',M,33.32,35.25,53.70,'N4b')
put('whis',WH,.78,3.80,56.30,'WH')
put('nar',M,36.51,38.68,59.90,'N5')
put('nar',M,40.37,41.56,62.90,'N6a');put('nar',M,42.06,43.49,64.50,'N6b');put('nar',M,44.28,45.09,66.50,'N6c');put('nar',M,45.80,47.46,67.90,'N6d');put('nar',M,48.31,49.77,72.50,'N6e')
put('nar',M,51.27,56.04,74.70,'N7')
def save(x,f):wf.write(f,SR,(np.clip(x,-1,1)*32767).astype(np.int16))
save(trk['nar'],'t_nar.wav');save(trk['whis'],'t_whis.wav')
def ff(i,o,af):subprocess.run(['ffmpeg','-y','-loglevel','error','-i',i,'-af',af,'-ar','48000','-ac','1',o],check=True)
ff('t_nar.wav','p_nar.wav',"highpass=f=70,equalizer=f=140:t=h:w=160:g=3,acompressor=threshold=-24dB:ratio=3:attack=8:release=150:makeup=4,loudnorm=I=-16:TP=-1.5:LRA=8")
ff('t_whis.wav','p_whis.wav',"highpass=f=130,lowpass=f=5000,acompressor=threshold=-30dB:ratio=3:makeup=6,aecho=0.8:0.55:70|140|260|420:0.5|0.4|0.3|0.2,loudnorm=I=-21:TP=-2:LRA=6")
vm=rd('p_nar.wav');wm=rd('p_whis.wav')
def fixn(x):
    x=x[:N];return np.pad(x,(0,N-len(x)))
vm=fixn(vm);wm=fixn(wm)
ref=np.sqrt(np.mean(vm[np.abs(vm)>.02]**2))
def match(x,target):
    a=np.abs(x)>.004;return x*(target/np.sqrt(np.mean(x[a]**2)+1e-9))
fr=match(radio_fx(trk['radio'],3,.016),ref*1.0);fh=match(radio_fx(trk['hook'],5,.022),ref*.95);fa=match(trk['ali'],ref*1.05)
print('ref rms',ref)
# envelope of Ali for visuals
env=[];w=int(.033*SR)
for k in range(int(30.0*30),int(47.0*30)):
    s=int(k/30*SR);seg=fa[s:s+w];env.append(float(np.sqrt(np.mean(seg**2)+1e-12)))
mx=max(env);env=[round(v/mx,3) for v in env]
# ------------- SFX -------------
SL=np.zeros(N,dtype=np.float32);SRr=np.zeros(N,dtype=np.float32);BL=np.zeros(N,dtype=np.float32);BR=np.zeros(N,dtype=np.float32)  # bed buses
def place(x,t0,g=1.0,pan=0.0,bed=False):
    i=int(t0*SR);j=min(N,i+len(x))
    if j<=i:return
    a,b=(BL,BR) if bed else (SL,SRr)
    a[i:j]+=x[:j-i]*g*(1-max(0,pan));b[i:j]+=x[:j-i]*g*(1+min(0,pan))
def gate(x,a=.005,r=.005):
    i=min(int(a*SR),len(x));o=min(int(r*SR),len(x));x[:i]*=np.linspace(0,1,i);x[len(x)-o:]*=np.linspace(1,0,o);return x
def eas(d):t=Tt(int(d*SR));return ((np.sin(2*np.pi*853*t)+np.sin(2*np.pi*960*t))*.5).astype(np.float32)
def static(d,g):
    n=int(d*SR);x=bp(noise(n),600,7500,2);bur=np.abs(lp_(noise(n),9,1))>.3;return (x*(.35+1.4*bur)*g).astype(np.float32)
def reverb(y,taps):
    for d,gg in taps:
        k=int(d*SR);y[k:]+=y[:-k]*gg
    return y
def knock(s,muffle=False,seed=0):
    n=int(1.8*SR);t=Tt(n);f=60-20*(1-np.exp(-t/.08));ph=2*np.pi*np.cumsum(f)/SR
    b=np.sin(ph)*np.exp(-t/.22);w=np.sin(2*np.pi*190*t)*np.exp(-t/.07)*.45;c=lp_(noise(n),500,2)*np.exp(-t/.03)*.9
    y=(b+w+c)*s
    y=reverb(y,[(.09,.45),(.19,.32),(.33,.22),(.52,.14)])
    if muffle:y=lp_(y,700,3)*1.6
    return y.astype(np.float32)
def door_knock(s=1.0):
    n=int(1.2*SR);t=Tt(n);x=np.sin(2*np.pi*110*t)*np.exp(-t/.09)*1.0+np.sin(2*np.pi*240*t)*np.exp(-t/.05)*.6+lp_(noise(n),1800,2)*np.exp(-t/.012)*1.1
    return reverb((x*s).astype(np.float32),[(.07,.3),(.15,.18)])
def scratch(d,g):
    n=int(d*SR);x=hp_(noise(n),1800,2);m=np.zeros(n);k=0
    while k<n:
        L=int((.12+rs.rand()*.35)*SR);L=min(L,n-k);m[k:k+L]=(.5+rs.rand()*.5)*np.sin(np.linspace(0,np.pi,L))**1.5;k+=L+int(rs.rand()*.08*SR)
    return (x*m*g).astype(np.float32)
def wind(d,g):
    n=int(d*SR);t=Tt(n);x=lp_(noise(n),700,2);m=.55+.45*np.sin(2*np.pi*.11*t)*np.sin(2*np.pi*.27*t+1);w=bp(noise(n),500,900,2)*(.5+.5*np.sin(2*np.pi*.17*t+2))*.6
    return ((x*m+w)*g).astype(np.float32)
def click(g=1.0):
    n=int(.25*SR);t=Tt(n);return ((hp_(noise(n),3000,2)*np.exp(-t/.004)*.9+np.sin(2*np.pi*1800*t)*np.exp(-t/.03)*.5)*g).astype(np.float32)
def tick(f,g):
    n=int(.12*SR);t=Tt(n);return ((np.sin(2*np.pi*f*t)*np.exp(-t/.012)+hp_(noise(n),2500,2)*np.exp(-t/.004))*g).astype(np.float32)
def thud(f0,d,g,tau=.18):
    n=int(d*SR);t=Tt(n);f=f0*(1+.6*np.exp(-t/.06));ph=2*np.pi*np.cumsum(f)/SR;return (np.sin(ph)*np.exp(-t/tau)*g).astype(np.float32)
def siren(d,g):
    n=int(d*SR);t=Tt(n);f=520+230*np.sin(2*np.pi*t/7.5-1.2);ph=2*np.pi*np.cumsum(f)/SR
    x=lp_((np.sin(ph)+.35*np.sin(2*ph)+.15*np.sin(3*ph)).astype(np.float32),2600,2)
    return (reverb(x,[(.45,.4),(.9,.25)])*g).astype(np.float32)
def drone(d,g):
    n=int(d*SR);t=Tt(n);x=np.sin(2*np.pi*55*t)+.6*np.sin(2*np.pi*82.4*t+1)+.25*np.sin(2*np.pi*110.5*t);return (x*(.7+.3*np.sin(2*np.pi*.08*t))*g).astype(np.float32)
def buzz(g):
    n=int(.25*SR);t=Tt(n);x=(np.sign(np.sin(2*np.pi*150*t))*.5+np.sin(2*np.pi*300*t)*.3)*(.6+.4*np.sin(2*np.pi*38*t))*np.sin(np.pi*np.linspace(0,1,n))
    return (bp(x.astype(np.float32),100,1800,2)*g).astype(np.float32)
def beep(f,d,g):
    n=int(d*SR);t=Tt(n);return gate((np.sin(2*np.pi*f*t)*g).astype(np.float32),.004,.006)
def crt_off(g=1.0):
    n=int(1.1*SR);t=Tt(n);f=14000*np.exp(-t/.09)+300;ph=2*np.pi*np.cumsum(f)/SR;y=(np.sin(ph)*np.exp(-t/.12)*.5).astype(np.float32)
    k=int(.45*SR);p=thud(70,.4,1.0,.07);y[k:k+len(p)]+=p[:n-k]*.9;y+=(hp_(noise(n),4000,2)*np.exp(-t/.08)*.35).astype(np.float32);return y*g
# hook
place(eas(1.2),.28,.30);place(eas(4.8),1.28,.07);place(static(.30,1.4),0.0,.6)
place(static(6.0,.05),0.2);place(static(5.8,.03),6.3)
for t0 in [3.55,4.50,5.85,10.1]:place(static(.18,.5),t0)
place(scratch(.8,.18),.7);place(scratch(1.6,.16),1.2)
place(static(6.6,.03),6.7)  # under R1
# room / clock
place(click(.4),13.8)
t0=13.7;i=0
while t0<29.5:place(tick(2200 if i%2==0 else 1800,.05),t0,1.0,bed=True);t0+=1.0;i+=1
place(wind(CRT0-13.0,.05),13.0,1.0,.2,bed=True);place(drone(CRT0-13.0,.05),13.0,1.0,bed=True)
for k in range(4):place(scratch(.45,.12),18.9+k*.6)
place(scratch(.8,.12),32.6);place(scratch(.4,.12),37.3);place(scratch(.6,.12),35.0)
# phone
for a in [29.55,29.95,30.35]:place(buzz(.35),a)
for k in range(3):place(beep(1000,.12,.1),46.6+k*.24)
# door even knocks
for a in [50.7,51.7,52.7]:place(door_knock(1.0),a)
# hand / silence beat / wall knocks
place(thud(45,1.2,1.1,.45),62.85);place(scratch(.6,.1),62.8)
for a,s in [(70.0,.8),(70.8,.6),(71.9,1.0)]:place(knock(s,True),a)
place(scratch(1.3,.12),72.5)
bt=62.9
while bt<CRT0-.1:place(thud(52,.5,.5,.1),bt,1.0,bed=True);place(thud(52,.5,.32,.1),bt+.24,1.0,bed=True);bt+=.86
sn=siren(CRT0-56.0,.5)*np.linspace(0,1,int((CRT0-56.0)*SR))**1.6;place(sn,56.0,.12,bed=True)
place(crt_off(1.0),CRT0);place(gate(eas(.7)*np.linspace(1,0,int(.7*SR)).astype(np.float32),.01,.05),81.6,.18)
# ------------- music -------------
mus=rd('music48.wav');loop=mus[:int(23.7*SR)].copy();fd=int(.015*SR);loop[:fd]*=np.linspace(0,1,fd);loop[-fd:]*=np.linspace(1,0,fd)
M2=np.tile(loop,int(np.ceil(N/len(loop))))[:N];t=Tt(N)
g=np.zeros(N,dtype=np.float32);g[t>=6.05]=.15;g*=np.clip((t-6.05)/2.0,0,1)
duck=np.ones(N,dtype=np.float32)
def setv(a,b,v):duck[int(a*SR):int(b*SR)]=v
def lerpe(a,b,v0,v1):duck[int(a*SR):int(b*SR)]=np.linspace(v0,v1,int(b*SR)-int(a*SR))
lerpe(49.8,50.6,1,.3);setv(50.6,53.6,.3);lerpe(53.6,54.6,.3,1)
lerpe(69.2,69.9,1,.3);setv(69.9,72.4,.3);lerpe(72.4,73.2,.3,1)
setv(62.1,62.8,0);lerpe(62.8,64.5,0,1.5);setv(64.5,CRT0,1.5);setv(CRT0,TOTAL,0)
mus_m=M2*g*duck
sb=np.ones(N,dtype=np.float32);sb[int(62.1*SR):int(62.8*SR)]=0;sb[int(62.0*SR):int(62.1*SR)]=np.linspace(1,0,int(62.1*SR)-int(62.0*SR))
sb[int(CRT0*SR):]=0
voice=vm+wm+fr+fh+fa
LR=voice+SL+BL*sb+mus_m;RR=voice+SRr+BR*sb+mus_m
out=np.stack([LR,RR],1);print('peak before',np.abs(out).max())
out=out*.42;wf.write('mix_pre.wav',SR,(np.clip(out,-1,1)*32767).astype(np.int16))
subprocess.run(['ffmpeg','-y','-loglevel','error','-i','mix_pre.wav','-af','alimiter=limit=0.9:attack=5:release=80,loudnorm=I=-15:TP=-1.2:LRA=11','-ar','48000','mix.wav'],check=True)
# ------------- subtitles -------------
def mp(raw,seg):a,b=seg;return raw
CH=[((1.30,3.67),[("اگه داری *این صدارو* میشنوی",9)]),((4.67,6.05),[("*یعنی* دیر شده.",5)]),
((6.75,8.63),[("ساکنین، *درها رو قفل کنید.*",10)]),((9.16,13.01),[("از خونه *بیرون نیایید.*",8),("تکرار می‌کنم: *درها رو قفل کنید.*",13)]),
((13.70,16.23),[("ساعت *سه* صبحه",5),("درها همه *قفلن.*",6)]),
((16.95,19.92),[("از *پنجره* نگاه می‌کنی",9),("خیابون پر از *آدمه*",8)]),((20.40,22.48),[("ولی *هیچ‌کس* تکون نمی‌خوره",10)]),((22.90,26.05),[("همه سرشونو *بالا* گرفتن",10),("و به پنجره‌ی تو *خیره‌ان*",9)]),
((26.70,29.54),[("*گوشیت* زنگ می‌خوره",7),("*علی.*",2)]),
((30.60,32.00),[("*رفیق،* گوش کن!",5)]),((32.58,34.10),[("ساعت چهار *ماشینم* دم درته",11)]),((34.76,36.59),[("تا اون موقع اگه *کسی در زد،*",11)]),((37.15,38.63),[("حتی *مامانت،* باز نکن",8)]),
((39.27,42.09),[("اونا *آدم نیستن.*",7),("و نذار *بفهمن* که فهمیدی!",10)]),((42.75,44.33),[("من *خودمم* یادم نمیاد…",9)]),((44.99,46.33),[("چطوری *رسیدم* اینجا.",8)]),
((47.10,50.18),[("تلفن *قطع* می‌شه",7),("در *می‌خوره.* سه بار",6)]),((53.70,55.63),[("*دقیقاً* به یه اندازه",8)]),
((56.30,57.71),[("*مرد گچی…*",3)]),((58.16,59.32),[("*مرد گچی…*",3)]),
((59.90,62.07),[("صدای *خودته.*",5),("ولی *بی‌نفس.*",5)]),
((62.90,64.09),[("بعد از توی *دیوار*",7)]),((64.50,65.93),[("یه *دست* بیرون میاد",6)]),((66.50,67.31),[("*می‌لرزه.*",4)]),((67.90,69.56),[("سه ضربه‌ی *نامنظم*",7)]),((72.50,73.96),[("*مینا.* همسایه‌ات",6)]),
((74.70,78.45),[("به *علی* اعتماد می‌کنی",9),("یا به *مینا؟*",4),("بنویس: *یک،* علی",6)]),((78.60,79.47),[("*دو،* مینا",3)])]
L=[];S=[]
for (a,b),items in CH:
    tot=sum(s for _,s in items);c=a
    for txt,sy in items:
        d=(b-a)*sy/tot;L.append([round(c,3),round(c+d,3)]);S.append(txt);c+=d
json.dump({"TOTAL":TOTAL,"lines":L,"subs":S,"env":env,"env0":30.0},open('timing_ep1.json','w'),ensure_ascii=False)
print('chunks',len(L))
