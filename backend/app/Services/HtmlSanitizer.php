<?php

namespace App\Services;

use HTMLPurifier;
use HTMLPurifier_Config;

/**
 * Cleans admin-authored HTML (CMS page content) before it is saved.
 *
 * Keeps the formatting the rich text editor produces (headings, lists, links,
 * images, tables, text alignment) and removes anything that could run code on
 * a public site: <script>, <iframe>, <style>, on* event attributes,
 * javascript: links, and every inline style except text-align.
 */
class HtmlSanitizer
{
    private static ?HTMLPurifier $purifier = null;

    public static function clean(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return $html;
        }

        return trim(self::purifier()->purify($html));
    }

    private static function purifier(): HTMLPurifier
    {
        if (self::$purifier) {
            return self::$purifier;
        }

        $config = HTMLPurifier_Config::createDefault();
        $config->set('HTML.Doctype', 'HTML 4.01 Transitional');
        $config->set('HTML.Allowed', implode(',', [
            'h1[style]', 'h2[style]', 'h3[style]', 'h4[style]', 'p[style]',
            'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre', 'blockquote',
            'ul', 'ol[start]', 'li',
            'a[href|title|target|rel]',
            'img[src|alt|title|width|height]',
            'table', 'colgroup', 'col[span|width]', 'thead', 'tbody', 'tr',
            'th[colspan|rowspan]', 'td[colspan|rowspan]',
        ]));
        $config->set('CSS.AllowedProperties', 'text-align');
        $config->set('URI.AllowedSchemes', ['http' => true, 'https' => true, 'mailto' => true, 'tel' => true]);
        $config->set('Attr.AllowedFrameTargets', ['_blank']);
        $config->set('Attr.AllowedRel', ['noopener', 'noreferrer', 'nofollow']);
        $config->set('AutoFormat.RemoveEmpty', false);

        // Cache the compiled rules in storage/app/purifier (created on first use).
        $cache = storage_path('app/purifier');
        if (!is_dir($cache)) {
            @mkdir($cache, 0755, true);
        }
        if (is_dir($cache) && is_writable($cache)) {
            $config->set('Cache.SerializerPath', $cache);
        } else {
            $config->set('Cache.DefinitionImpl', null);
        }

        return self::$purifier = new HTMLPurifier($config);
    }
}
