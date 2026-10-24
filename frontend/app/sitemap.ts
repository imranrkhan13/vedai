import type {MetadataRoute} from 'next';
import {siteUrl} from '@/lib/seo';
export default function sitemap():MetadataRoute.Sitemap{return [{url:siteUrl,changeFrequency:'monthly',priority:1},{url:siteUrl+'/waitlist',changeFrequency:'monthly',priority:0.7}];}
