import Link from 'next/link';
export default function Brand({href='/'}:{href?:string}){
 return <Link href={href} className="quesly-brand" aria-label="Quesly home"><span className="quesly-brand-mark" aria-hidden="true">q.</span><span>quesly<span className="quesly-brand-dot">.</span></span></Link>;
}
