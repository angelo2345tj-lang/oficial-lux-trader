import {motion} from "framer-motion";
import Logo from "./Logo";

export default function SplashScreen(){

return(

<div className="
fixed
inset-0
bg-[#030305]
flex
flex-col
items-center
justify-center
z-50
overflow-hidden
">

<motion.div
animate={{
scale:[0.8,1.05,1],
opacity:[0,1]
}}
transition={{
duration:2
}}
className="
flex
flex-col
items-center
"
>

<div className="
w-40
h-40
rounded-full
bg-gradient-to-br
from-blue-600/30
via-black
to-green-500/20
border
border-blue-500/30
shadow-[0_0_70px_rgba(37,99,235,.35)]
flex
items-center
justify-center
">

<Logo className="w-24 h-24"/>

</div>

<h1 className="
mt-8
text-white
font-black
text-3xl
tracking-[6px]
">

LUX TRADER FX

</h1>

<p className="
mt-3
text-zinc-500
uppercase
text-xs
tracking-[4px]
">

Inicializando IA Premium...

</p>

<div className="
w-64
h-2
bg-zinc-800
rounded-full
overflow-hidden
mt-8
">

<motion.div
animate={{
width:["0%","100%"]
}}
transition={{
duration:4
}}
className="
h-full
bg-gradient-to-r
from-blue-500
to-green-400
"
/>

</div>

</motion.div>

</div>

)

}