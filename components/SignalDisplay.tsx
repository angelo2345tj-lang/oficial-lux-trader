import React,{useState,useRef} from "react";
import html2canvas from "html2canvas";

import{
TrendingUp,
TrendingDown,
Gauge,
Layers,
AlertTriangle,
ChevronRight,
Camera,
Check,
RefreshCw,
Save
}from"lucide-react";

import Logo from "./Logo";

import{
TradeSignal,
SignalType,
TradeHistoryItem
}from"../types";

interface Props {
  signal: TradeSignal;
  banca: number;
  onRegisterResult: (item: TradeHistoryItem) => void;
  onOpenSaveModal?: () => void;
  soundEnabled?: boolean;
  onChangeTimeframe?: (tf: string) => void;
}

const SignalDisplay: React.FC<Props> = ({
  signal,
  banca,
  onRegisterResult,
  onOpenSaveModal,
}) => {

const cardRef=useRef<HTMLDivElement>(null);

const[loading,setLoading]=useState(false);
const[copied,setCopied]=useState(false);

const isBuy=signal.type===SignalType.BUY;

async function handleShare(){

if(!cardRef.current)return;

setLoading(true);

try{

const canvas=await html2canvas(
cardRef.current,
{
backgroundColor:"#050507",
scale:4,
useCORS:true,
logging:false
}
);

const url=canvas.toDataURL();

const a=document.createElement("a");

a.href=url;

a.download=`Lux-${signal.asset}.png`;

a.click();

setCopied(true);

setTimeout(()=>{

setCopied(false)

},3000);

}catch(e){

console.log(e)

}
finally{

setLoading(false)

}

}

return(

<div className="max-w-4xl mx-auto p-2 pb-20">

<div
ref={cardRef}
className="
bg-[#050507]
rounded-[35px]
p-5
space-y-5
shadow-2xl
border
border-white/5
text-white
antialiased
"
style={{
WebkitFontSmoothing:"antialiased",
textRendering:"geometricPrecision"
}}
>

{/* HEADER */}

<div className="flex justify-between items-center">

<div className="flex items-center gap-3">

<div className={`
w-16
h-16
rounded-2xl
flex
items-center
justify-center
${isBuy
?"bg-blue-500/10 text-blue-500"
:"bg-red-500/10 text-red-500"}
`}>

{isBuy
?<TrendingUp size={28}/>
:<TrendingDown size={28}/>
}

</div>

<div>

<div className="flex gap-2 items-center">

<h1 className="
font-black
text-2xl
md:text-3xl
tracking-tight
leading-none
">

{signal.asset}

</h1>

<div className={`
px-2
py-1
rounded-md
text-[10px]
font-bold
${isBuy
?"bg-blue-500/20 text-blue-400"
:"bg-red-500/20 text-red-400"}
`}>

{isBuy?"CALL":"PUT"}

</div>

</div>

<p className="
uppercase
text-[11px]
tracking-[2px]
text-zinc-400
">

{isBuy?"COMPRA":"VENDA"}

</p>

</div>

</div>

<div className="text-right">

<h2 className="
text-4xl
font-black
leading-none
">

{signal.confidence ?? signal.score}%

</h2>

<p className="
text-[10px]
uppercase
text-zinc-500
tracking-[2px]
">

CONFLUÊNCIA

</p>

</div>

</div>


{/* NIVEIS */}

<div className="grid grid-cols-2 gap-3">

<div className="
bg-black/50
rounded-2xl
p-4
text-center
">

<p className="
text-zinc-500
text-[10px]
uppercase
">

Entrada

</p>

<h3 className="
font-mono
text-blue-400
font-black
text-xl
">

{signal.entry.toFixed(5)}

</h3>

</div>

<div className="
bg-black/50
rounded-2xl
p-4
text-center
">

<p className="
text-zinc-500
text-[10px]
uppercase
">

STOP

</p>

<h3 className="
font-mono
text-red-400
font-black
text-xl
">

{signal.sl.toFixed(5)}

</h3>

</div>

</div>


{/* CONFLUENCIA */}

<div className="
bg-black/40
rounded-3xl
p-5
space-y-3
">

<div className="flex gap-2">

<Gauge
size={18}
className="text-cyan-400"
/>

<h4 className="
font-bold
uppercase
text-sm
">

Confluência Técnica

</h4>

</div>

{[
["RSI",isBuy?"COMPRA":"VENDA"],
["MACD","CRUZADO"],
["EMA12","ALTA"],
["BOLLINGER","EXPANSÃO"],
["SMC","BOS"],
["VOLUME","FORTE"],
["FIBO","61.8"],
["ICHIMOKU","CONFIRMADO"]
].map(item=>(

<div
key={item[0]}
className="
flex
justify-between
bg-black/50
rounded-xl
p-3
"
>

<span className="text-zinc-400 text-xs">

{item[0]}

</span>

<span className="
font-bold
text-xs
">

{item[1]}

</span>

</div>

))}

</div>


{/* MULTI TF */}

<div className="
bg-black/40
rounded-3xl
p-5
">

<div className="flex gap-2 mb-4">

<Layers
size={18}
className="text-blue-400"
/>

<h4 className="
uppercase
font-bold
text-sm
">

Multi-Timeframe

</h4>

</div>

<div className="
grid
grid-cols-4
gap-2
">

{["M5","M15","H1","H4"].map(x=>(

<div
key={x}
className="
bg-black/50
rounded-xl
text-center
p-3
"
>

<p className="
text-zinc-500
text-[10px]
">

{x}

</p>

<p className="
text-green-400
font-bold
text-xs
">

Bullish

</p>

</div>

))}

</div>

</div>


{/* RISCO */}

<div className="
bg-amber-500/5
border
border-amber-500/20
rounded-3xl
p-4
">

<div className="
flex
gap-2
mb-3
">

<AlertTriangle
size={16}
className="text-amber-400"
/>

<p className="
uppercase
font-bold
text-xs
text-amber-400
">

Riscos

</p>

</div>

{signal.risks.map((risk,i)=>(

<div
key={i}
className="
flex
gap-2
text-xs
text-amber-200
mb-2
">

<ChevronRight size={14}/>
{risk}

</div>

))}

</div>

<div className="
flex
flex-col
items-center
opacity-20
pt-5
">

<Logo className="w-14"/>

<p className="
text-[10px]
tracking-[4px]
">

LUX TRADER FX

</p>

</div>

</div>

{onOpenSaveModal&&(

<button
onClick={onOpenSaveModal}
className="
w-full
bg-zinc-900
rounded-2xl
py-5
font-black
text-white
flex
justify-center
gap-2
mt-4
">

<Save size={18}/>
SALVAR

</button>

)}

<button
onClick={handleShare}
className="
w-full
bg-blue-600
hover:bg-blue-500
rounded-2xl
py-5
font-black
text-white
flex
justify-center
gap-2
mt-3
transition-all
duration-300
shadow-[0_0_30px_rgba(37,99,235,0.35)]
"
>

{loading
?<RefreshCw className="animate-spin"/>
:copied
?<Check/>
:<Camera/>
}

{loading
?"GERANDO..."
:copied
?"COPIADO"
:"COMPARTILHAR"}

</button>

</div>

)

}

export default SignalDisplay;