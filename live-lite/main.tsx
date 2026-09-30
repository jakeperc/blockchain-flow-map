/** Static, backend-free entry: the full Blockchain Flow Map UI with an in-browser live Ethereum source. */
import {createRoot} from 'react-dom/client';
import Atlas from '@/components/atlas';
import {aggregate} from '@/lib/atlas/engine';
import {createLiveSource} from '@/lib/atlas/live-client';
import '@/app/globals.css';
const source=createLiveSource();
createRoot(document.getElementById('root')!).render(<Atlas initial={aggregate([],'1H',Date.now())} source={source}/>);
