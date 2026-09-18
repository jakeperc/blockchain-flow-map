import Atlas from '@/components/atlas';
import {demoSnapshot} from '@/lib/atlas/engine';
export default function Page(){return <Atlas initial={demoSnapshot()}/>;}
