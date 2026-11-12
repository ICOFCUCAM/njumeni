import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLovdataDocument, parseMarkup, decodeEntities } from '../src/modules/legal-knowledge/lovdata-document.ts';
import {
  decodeLovdataArchive, readTarEntries, parsePublicDataList, createLovdataHttpArchiveSource,
  LOVDATA_USER_AGENT,
} from '../src/modules/legal-knowledge/lovdata-archive.ts';
import {
  createLovdataAdapter, LOVDATA_MANIFEST, LOVDATA_ADAPTER_KEY, LOVDATA_ADAPTER_VERSION,
  lovdataArchiveSourceFromEnv, lovdataAdapterRegistration,
} from '../src/modules/legal-knowledge/lovdata-adapter.ts';
import { createLegalAdapterRegistry } from '../src/modules/legal-knowledge/adapter-registry.ts';
import { normaliseAuthority, createSectionPassages } from '../src/modules/legal-knowledge/contracts.ts';
import { workerAdapterRegistrations } from '../src/modules/legal-knowledge/worker-adapters.ts';

// Excerpts of two documents from Lovdata's free dataset gjeldende-lover.tar.bz2
// (https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2, lastModified 2026-11-11T02:32:00Z).
// Source: Lovdata. Licensed under the Norwegian Licence for Open Government Data (NLOD) 2.0.
// Shortened for testing: the table of contents, legal areas and all but the first sections removed.
const AML = "<!DOCTYPE html><html lang=\"nb\"><head><title>Lov om arbeidsmiljø, arbeidstid og stillingsvern mv. (arbeidsmiljøloven)</title><base href=\"https://lovdata.no/\" /></head><body><header class=\"documentHeader\" id=\"hode\"><dl class=\"data-document-key-info\"><dt class=\"legacyID\">Datokode</dt><dd class=\"legacyID\">LOV-2005-06-17-62</dd><dt class=\"dokid\">DokumentID</dt><dd class=\"dokid\">NL/lov/2005-06-17-62</dd><dt class=\"ministry\">Departement</dt><dd class=\"ministry\"><ul><li>Arbeids- og inkluderingsdepartementet</li></ul></dd><dt class=\"dateInForce\">I kraft fra</dt><dd class=\"dateInForce\">2006-01-01</dd><dt class=\"lastChangeInForce\">Ikrafttredelse av siste endring</dt><dd class=\"lastChangeInForce\">2026-07-01</dd><dt class=\"lastChangedBy\">Sist endret ved</dt><dd class=\"lastChangedBy\"><a href=\"lov/2026-06-19-33\">lov/2026-06-19-33</a> fra 2026-07-01</dd><dt class=\"changesToDocuments\">Endrer</dt><dd class=\"changesToDocuments\"><ul><li><a href=\"lov/1977-02-04-4\">lov/1977-02-04-4</a></li></ul></dd><dt class=\"dateOfPublication\">Kunngjort</dt><dd class=\"dateOfPublication\">2005-06-17</dd><dt class=\"lastupdated\">Siste rettelse</dt><dd class=\"lastupdated\">2022-04-08 (inkurienote § 14-15)</dd><dt class=\"eeaReferences\">EU/EØS-henvisning</dt><dd class=\"eeaReferences\"><a href=\"avtale/avt-1992-05-02-1-v18\">EØS-avtalen vedlegg XVIII</a>.</dd><dt class=\"titleShort\">Korttittel</dt><dd class=\"titleShort\">Arbeidsmiljøloven – aml</dd><dt class=\"title\">Tittel</dt><dd class=\"title\">Lov om arbeidsmiljø, arbeidstid og stillingsvern mv. (arbeidsmiljøloven)</dd><dt class=\"refid\">RefID</dt><dd class=\"refid\">lov/2005-06-17-62</dd><dt class=\"eli\">European Legislative Identifier</dt><dd class=\"eli\">/eli/lov/2005/06/17/62</dd></dl></header><main class=\"documentBody\" data-lovdata-URL=\"NL/lov/2005-06-17-62\" id=\"dokument\"><h1>Lov om arbeidsmiljø, arbeidstid og stillingsvern mv. (arbeidsmiljøloven)</h1><section class=\"section\" data-name=\"kap1\" id=\"kapittel-1\" data-lovdata-URL=\"NL/lov/2005-06-17-62/KAPITTEL_1\"><h2>Kapittel 1. Innledende bestemmelser</h2><article class=\"legalArticle\" data-lovdata-URL=\"NL/lov/2005-06-17-62/§1-1\" data-name=\"§1-1\" id=\"kapittel-1-paragraf-1\"><h3 class=\"legalArticleHeader\"><span class=\"legalArticleValue\">§ 1-1</span>. <span class=\"legalArticleTitle\">Lovens formål</span></h3><article class=\"legalP\" id=\"kapittel-1-paragraf-1-ledd-1\">Lovens formål er:<ol class=\"defaultList\" type=\"a\"><li data-name=\"a.\" value=\"1\"><article class=\"listArticle\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-1\"><article class=\"legalP\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-1-ledd-1\">å sikre et arbeidsmiljø som gir grunnlag for en helsefremmende og meningsfylt arbeidssituasjon, som gir full trygghet mot fysiske og psykiske skadevirkninger, og med en velferdsmessig standard som til enhver tid er i samsvar med den teknologiske og sosiale utvikling i samfunnet,</article></article></li><li data-name=\"b.\" value=\"2\"><article class=\"listArticle\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-2\"><article class=\"legalP\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-2-ledd-1\">å sikre trygge ansettelsesforhold og likebehandling i arbeidslivet,</article></article></li><li data-name=\"c.\" value=\"3\"><article class=\"listArticle\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-3\"><article class=\"legalP\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-3-ledd-1\">å legge til rette for et godt ytringsklima i virksomheten,</article></article></li><li data-name=\"d.\" value=\"4\"><article class=\"listArticle\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-4\"><article class=\"legalP\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-4-ledd-1\">å legge til rette for tilpasninger i arbeidsforholdet knyttet til den enkelte arbeidstakers forutsetninger og livssituasjon,</article></article></li><li data-name=\"e.\" value=\"5\"><article class=\"listArticle\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-5\"><article class=\"legalP\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-5-ledd-1\">å gi grunnlag for at arbeidsgiver og arbeidstakerne i virksomhetene selv kan ivareta og utvikle sitt arbeidsmiljø i samarbeid med arbeidslivets parter og med nødvendig veiledning og kontroll fra offentlig myndighet,</article></article></li><li data-name=\"f.\" value=\"6\"><article class=\"listArticle\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-6\"><article class=\"legalP\" id=\"kapittel-1-paragraf-1-ledd-1-punkt-6-ledd-1\">å bidra til et inkluderende arbeidsliv.</article></article></li></ol></article><article class=\"changesToParent\">Endret ved lover <a href=\"lov/2005-12-21-121\">21 des 2005 nr. 121</a> (ikr. 1 jan 2006), <a href=\"lov/2019-06-21-24\">21 juni 2019 nr. 24</a> (ikr. 1 jan 2020 iflg. <a href=\"forskrift/2019-06-21-806\">res. 21 juni 2019 nr. 806</a>).</article></article><article class=\"legalArticle\" data-lovdata-URL=\"NL/lov/2005-06-17-62/§1-2\" data-name=\"§1-2\" id=\"kapittel-1-paragraf-2\"><h3 class=\"legalArticleHeader\"><span class=\"legalArticleValue\">§ 1-2</span>. <span class=\"legalArticleTitle\">Hva loven omfatter</span></h3><article class=\"numberedLegalP\" data-numerator=\"1\" id=\"kapittel-1-paragraf-2-nummer-1\">(1) Loven gjelder for virksomhet som sysselsetter arbeidstaker, med mindre annet er uttrykkelig fastsatt i loven.</article><article class=\"numberedLegalP\" data-numerator=\"2\" id=\"kapittel-1-paragraf-2-nummer-2\">(2) Unntatt fra loven er:<ol class=\"defaultList\" type=\"a\"><li data-name=\"a.\" value=\"1\"><article class=\"listArticle\" id=\"kapittel-1-paragraf-2-nummer-2-punkt-1\"><article class=\"legalP\" id=\"kapittel-1-paragraf-2-nummer-2-punkt-1-ledd-1\">sjøfart, fangst og fiske, herunder bearbeiding av fangsten ombord i skip, men likevel slik at dykkeoperasjoner og losing er omfattet av loven</article></article></li><li data-name=\"b.\" value=\"2\"><article class=\"listArticle\" id=\"kapittel-1-paragraf-2-nummer-2-punkt-2\"><article class=\"legalP\" id=\"kapittel-1-paragraf-2-nummer-2-punkt-2-ledd-1\">militær luftfart som omfattes av <a href=\"lov/1993-06-11-101\">luftfartsloven</a>.</article></article></li></ol><p class=\"leddfortsettelse\">Departementet kan gi forskrift om unntak fra loven for sivil luftfart og annen statsluftfart enn militær luftfart og om særregler for slik luftfart og om lovens anvendelse for dykkeoperasjoner og om særregler og unntak for slike operasjoner.</p></article><article class=\"numberedLegalP\" data-numerator=\"3\" id=\"kapittel-1-paragraf-2-nummer-3\">(3) Kongen kan gi forskrift om og i hvilken utstrekning bestemmelsene i <a href=\"lov/2005-06-17-62/kap14\">kapittel 14</a>, <a href=\"lov/2005-06-17-62/kap15\">15</a>, <a href=\"lov/2005-06-17-62/kap16\">16</a> og <a href=\"lov/2005-06-17-62/kap17\">17</a> skal gjelde for arbeidstakere som omfattes av <a href=\"lov/2017-06-16-67\">lov 16. juni 2017 nr. 67</a> om statens ansatte mv. (statsansatteloven) eller som er embetsmenn.</article><article class=\"numberedLegalP\" data-numerator=\"4\" id=\"kapittel-1-paragraf-2-nummer-4\">(4) Kongen kan gi forskrift om at deler av den offentlige forvaltning, helt eller delvis skal unntas fra loven når virksomheten er av så særegen art at den vanskelig lar seg tilpasse lovens bestemmelser.</article><article class=\"changesToParent\">Endret ved lover <a href=\"lov/2005-12-21-121\">21 des 2005 nr. 121</a> (ikr. 1 jan 2006), <a href=\"lov/2018-06-22-45\">22 juni 2018 nr. 45</a> (ikr. 1 jan 2019 iflg. <a href=\"forskrift/2018-06-22-945\">res. 22 juni 2018 nr. 945</a>), <a href=\"lov/2021-05-07-29\">7 mai 2021 nr. 29</a> (i kraft 1 juli 2022 for så vidt gjelder losing iflg. <a href=\"forskrift/2022-06-17-1064\">res. 17 juni 2022 nr. 1064</a>), <a href=\"lov/2021-05-07-29\">7 mai 2021 nr. 29</a> (i kraft 1 juli 2024 for så vidt gjelder dykkeoperasjoner iflg. <a href=\"forskrift/2023-12-01-1941\">res. 1 des 2023 nr. 1941</a>), <a href=\"lov/2023-12-01-86\">1 des 2023 nr. 86</a> (i kraft 1 juli 2024 iflg. <a href=\"forskrift/2023-12-01-1942\">res. 1 des 2023 nr. 1942</a>).</article></article></section></main></body></html>";
const LUFTFART = "<!DOCTYPE html><html lang=\"nb\"><head><title>Lov om luftfart (luftfartsloven)</title><base href=\"https://lovdata.no/\" /></head><body><header class=\"documentHeader\" id=\"hode\"><dl class=\"data-document-key-info\"><dt class=\"legacyID\">Datokode</dt><dd class=\"legacyID\">LOV-1993-06-11-101</dd><dt class=\"dokid\">DokumentID</dt><dd class=\"dokid\">NL/lov/1993-06-11-101</dd><dt class=\"ministry\">Departement</dt><dd class=\"ministry\"><ul><li>Samferdselsdepartementet</li></ul></dd><dt class=\"dateInForce\">I kraft fra</dt><dd class=\"dateInForce\">1994-04-01, 1996-04-01</dd><dt class=\"lastChangeInForce\">Ikrafttredelse av siste endring</dt><dd class=\"lastChangeInForce\">2026-07-01</dd><dt class=\"lastChangedBy\">Sist endret ved</dt><dd class=\"lastChangedBy\"><a href=\"lov/2026-06-19-45\">lov/2026-06-19-45</a> fra 2026-07-01</dd><dt class=\"lastupdated\">Siste rettelse</dt><dd class=\"lastupdated\">2022-04-04 (tegnsetting i lister i loven tilpasset universell utforming)</dd><dt class=\"eeaReferences\">EU/EØS-henvisning</dt><dd class=\"eeaReferences\"><a href=\"avtale/avt-1992-05-02-1-v13\">EØS-avtalen vedlegg XIII</a> <br />nr. 66d (forordning <a href=\"eu/32010r0996\">(EU) nr. 996/2010</a>),<br />nr. 66gc (forordning <a href=\"eu/32014r0376\">(EU) nr. 376/2014</a>),<br />nr. 68aa (forordning <a href=\"eu/31997r2027\">(EF) nr. 2027/97</a> som endret ved forordning <a href=\"eu/32002r0889\">(EF) nr. 889/2002</a>),<br />nr. 66zb (forordning <a href=\"eu/32018r1139\">(EU) 2018/1139</a>).</dd><dt class=\"titleShort\">Korttittel</dt><dd class=\"titleShort\">Luftfartsloven – luftl</dd><dt class=\"title\">Tittel</dt><dd class=\"title\">Lov om luftfart (luftfartsloven)</dd><dt class=\"refid\">RefID</dt><dd class=\"refid\">lov/1993-06-11-101</dd><dt class=\"eli\">European Legislative Identifier</dt><dd class=\"eli\">/eli/lov/1993/06/11/101</dd></dl></header><main class=\"documentBody\" data-lovdata-URL=\"NL/lov/1993-06-11-101\" id=\"dokument\"><h1>Lov om luftfart (luftfartsloven)</h1><section class=\"section\" id=\"kapittel-1\" data-lovdata-URL=\"NL/lov/1993-06-11-101/KAPITTEL_1\"><h2>Innledende bestemmelser</h2><section class=\"section\" data-name=\"kapI\" id=\"kapittel-1-kapittel-1\" data-lovdata-URL=\"NL/lov/1993-06-11-101/KAPITTEL_1-1\"><h3>Kapittel I. Lovens virkeområde mv.</h3><article class=\"changesToParent\">Overskriften endret ved lov <a href=\"lov/2024-06-25-70\">25 juni 2024 nr. 70</a> (i kraft 1 juli 2024 iflg. <a href=\"forskrift/2024-06-25-1243\">res. 25 juni 2024 nr. 1243</a>).</article><article class=\"legalArticle\" data-lovdata-URL=\"NL/lov/1993-06-11-101/§1-1\" data-name=\"§1-1\" id=\"kapittel-1-kapittel-1-paragraf-1\"><h4 class=\"legalArticleHeader\"><span class=\"legalArticleValue\">§ 1-1</span>. <span class=\"legalArticleTitle\">Lovens generelle virkeområde</span></h4><article class=\"legalP\" id=\"kapittel-1-kapittel-1-paragraf-1-ledd-1\">Luftfart kan her i riket bare finne sted i samsvar med denne lov og forskrifter gitt med hjemmel i loven.</article><article class=\"legalP\" id=\"kapittel-1-kapittel-1-paragraf-1-ledd-2\">For luftfart som omfattes av EØS-avtalens bestemmelser,<sup class=\"footnotereference\" data-footnotereferencevalue=\"1\" data-unique-footnote-counter=\"1\">1</sup> gjelder regler om utfylling og gjennomføring av EØS-avtalen på luftfartens område i denne lov foran lovens øvrige bestemmelser.</article><article class=\"changesToParent\">Endret ved <a href=\"lov/2001-05-04-18\">lov 4 mai 2001 nr. 18</a> (ikr. 1 juli 2001 iflg. <a href=\"forskrift/2001-05-04-445\">res. 4 mai 2001 nr. 445</a>).</article><footer class=\"footnotes\"><article class=\"footnote\" data-name=\"1\" data-unique-footnote-counter=\"1\"><span class=\"footnoteLabel\">1</span> Jf. <a href=\"lov/1992-11-27-109/eøsl/a31\">EØS-avtalen art. 31-39</a> og <a href=\"avtale/avt-1992-05-02-1-v13\">vedlegg XIII kap. VI</a>.</article></footer></article></section></main></body></html>";

// A minimal Lovdata-style document with no numbered sections (as some historical acts are published).
const UNNUMBERED = '<!DOCTYPE html><html lang="nb"><head><title>Test</title><base href="https://lovdata.no/" /></head><body>' +
  '<header class="documentHeader"><dl class="data-document-key-info"><dt class="legacyID">Datokode</dt><dd class="legacyID">LOV-1812-02-25</dd>' +
  '<dt class="dokid">DokumentID</dt><dd class="dokid">NL/lov/1812-02-25</dd><dt class="refid">RefID</dt><dd class="refid">lov/1812-02-25</dd>' +
  '<dt class="title">Tittel</dt><dd class="title">Cancelli-Promemoria</dd></dl></header>' +
  '<main class="documentBody"><h1>Cancelli-Promemoria</h1><article class="legalP" id="ledd-1">Første ledd &amp; mer.</article></main></body></html>';

function tarFile(entries) {
  const blocks = [];
  for (const [name, content] of entries) {
    const data = Buffer.from(content, 'utf8');
    const header = Buffer.alloc(512);
    header.write(name, 0, 'utf8');
    header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
    header.write(data.length.toString(8).padStart(11, '0') + '\0', 124);
    header.write('00000000000\0', 136); header.write('        ', 148); header.write('0', 156);
    header.write('ustar\0', 257); header.write('00', 263);
    let sum = 0; for (const byte of header) sum += byte;
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return new Uint8Array(Buffer.concat(blocks));
}
// Test stand-in for the bzip2 runtime: the "compressed" bytes are "BZh" followed by the tar.
const identityDecoder = async () => (bytes) => bytes.subarray(3);
function fakeArchiveBytes(entries) {
  return new Uint8Array(Buffer.concat([Buffer.from('BZh'), Buffer.from(tarFile(entries))]));
}
function archiveSource(entries = [
  ['nl/nl-20050617-062.xml', AML], ['nl/nl-19930611-101.xml', LUFTFART], ['nl/nl-18120225-000.xml', UNNUMBERED],
]) {
  const compressed = fakeArchiveBytes(entries);
  return {
    loads: 0,
    async load() {
      this.loads++;
      return decodeLovdataArchive({
        filename: 'gjeldende-lover.tar.bz2', compressed, expectedSizeBytes: compressed.length,
        lastModified: '2026-11-11T02:32:00.000Z', retrievedAt: '2026-11-12T07:39:00.000Z',
        loadDecoder: identityDecoder,
      });
    },
  };
}

test('entities are decoded, including numeric references', () => {
  assert.equal(decodeEntities('a &amp; b &#167; &#xE5; &gt; &unknown;'), 'a & b § å > &unknown;');
});

test('the tokenizer tolerates the malformed lang attribute seen in the published data', () => {
  const root = parseMarkup('<html lang="nb&lt;br/>nr. 5 (direktiv &lt;a href=" eu="">x)"&gt;<head></head><body></body></html>');
  const html = root.children.find((node) => typeof node !== 'string' && node.tag === 'html');
  assert.ok(html.attrs.lang.startsWith('nb<br/>'));
});

test('key information is read from the document header', () => {
  const document = parseLovdataDocument(AML);
  assert.equal(document.languageCode, 'nb');
  assert.equal(document.baseHref, 'https://lovdata.no/');
  assert.equal(document.title, 'Lov om arbeidsmiljø, arbeidstid og stillingsvern mv. (arbeidsmiljøloven)');
  assert.equal(document.keyInfo.legacyID, 'LOV-2005-06-17-62');
  assert.equal(document.keyInfo.dokid, 'NL/lov/2005-06-17-62');
  assert.equal(document.keyInfo.refid, 'lov/2005-06-17-62');
  assert.equal(document.keyInfo.dateInForce, '2006-01-01');
  assert.equal(document.keyInfo.lastChangeInForce, '2026-07-01');
  assert.deepEqual(document.keyInfoItems.ministry, ['Arbeids- og inkluderingsdepartementet']);
  assert.deepEqual(document.keyInfoLinks.changesToDocuments, ['lov/1977-02-04-4']);
});

test('statute sections become section-level units with chapter and § paths', () => {
  const document = parseLovdataDocument(AML);
  assert.equal(document.sections.length, 2);
  assert.deepEqual(document.sections[0].path, ['Kapittel 1. Innledende bestemmelser', '§ 1-1']);
  assert.deepEqual(document.sections[1].path, ['Kapittel 1. Innledende bestemmelser', '§ 1-2']);
  const [first, second] = document.sections.map((section) => section.text.split('\n'));
  assert.equal(first[0], '§ 1-1. Lovens formål');
  assert.equal(first[2].slice(0, 30), 'a. å sikre et arbeidsmiljø som');
  assert.ok(second[1].startsWith('(1) Loven gjelder for virksomhet som sysselsetter arbeidstaker'));
  // Amendment notes ("Endret ved lover …") are editorial, not statute text.
  assert.ok(!document.sections.some((section) => section.text.includes('Endret ved')));
  assert.ok(document.references.includes('lov/1993-06-11-101'));
});

test('nested chapters are kept in the path and a single-date rule is not assumed', () => {
  const document = parseLovdataDocument(LUFTFART);
  assert.deepEqual(document.sections[0].path.slice(0, 2), ['Innledende bestemmelser', 'Kapittel I. Lovens virkeområde mv.']);
  assert.equal(document.keyInfo.dateInForce, '1994-04-01, 1996-04-01');
});

test('a document without numbered sections yields one unpathed unit', () => {
  const document = parseLovdataDocument(UNNUMBERED);
  assert.deepEqual(document.sections, [{ path: [], text: 'Første ledd & mer.' }]);
});

test('tar entries are read with checksum and path confinement', () => {
  const entries = readTarEntries(tarFile([['nl/a.xml', 'x'], ['nl/b.xml', 'yy']]));
  assert.deepEqual([...entries.keys()], ['nl/a.xml', 'nl/b.xml']);
  const corrupted = tarFile([['nl/a.xml', 'x']]); corrupted[0] = 0x4d;
  assert.throws(() => readTarEntries(corrupted), /LOVDATA_TAR_CHECKSUM_INVALID/);
  assert.throws(() => readTarEntries(tarFile([['../escape.xml', 'x']])), /LOVDATA_TAR_PATH_INVALID/);
});

test('archives are checked against the published size and the bzip2 signature', async () => {
  const compressed = fakeArchiveBytes([['nl/a.xml', 'x']]);
  const base = { filename: 'gjeldende-lover.tar.bz2', lastModified: null, retrievedAt: '2026-11-12T00:00:00.000Z', loadDecoder: identityDecoder };
  await assert.rejects(decodeLovdataArchive({ ...base, compressed, expectedSizeBytes: compressed.length + 1 }), /LOVDATA_ARCHIVE_SIZE_MISMATCH/);
  await assert.rejects(decodeLovdataArchive({ ...base, compressed: compressed.subarray(1), expectedSizeBytes: null }), /LOVDATA_ARCHIVE_NOT_BZIP2/);
  const archive = await decodeLovdataArchive({ ...base, compressed, expectedSizeBytes: compressed.length });
  assert.equal(archive.sourceUri, 'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2');
  assert.match(archive.sha256, /^[a-f0-9]{64}$/);
});

test('the public data listing is validated (sizeBytes arrives as a string)', () => {
  const [file] = parsePublicDataList([{ filename: 'gjeldende-lover.tar.bz2', description: 'Gjeldende lover', sizeBytes: '5809848', lastModified: '2026-11-11T02:32:00Z' }]);
  assert.equal(file.sizeBytes, 5809848);
  assert.throws(() => parsePublicDataList([{ filename: '../x.tar.bz2', sizeBytes: '1', lastModified: '2026-11-11T02:32:00Z' }]), /LIST_INVALID/);
});

test('the HTTP source identifies itself, requires the archive to be listed and maps throttling to a retry', async () => {
  const compressed = fakeArchiveBytes([['nl/nl-18120225-000.xml', UNNUMBERED]]);
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, agent: init.headers['user-agent'] });
    if (url.endsWith('/list')) return { ok: true, status: 200, json: async () => [{ filename: 'gjeldende-lover.tar.bz2', sizeBytes: String(compressed.length), lastModified: '2026-11-11T02:32:00Z' }] };
    return { ok: true, status: 200, arrayBuffer: async () => compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.length) };
  };
  const archive = await createLovdataHttpArchiveSource({ filename: 'gjeldende-lover.tar.bz2', fetch, loadDecoder: identityDecoder, now: () => new Date('2026-11-12T08:00:00Z') }).load();
  assert.equal(archive.retrievedAt, '2026-11-12T08:00:00.000Z');
  assert.deepEqual(calls.map((call) => call.url), ['https://api.lovdata.no/v1/publicData/list', 'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2']);
  assert.ok(calls.every((call) => call.agent === LOVDATA_USER_AGENT));
  const throttled = async () => ({ ok: false, status: 429 });
  await assert.rejects(createLovdataHttpArchiveSource({ filename: 'gjeldende-lover.tar.bz2', fetch: throttled }).load(), /RATE_LIMITED/);
  const unlisted = async () => ({ ok: true, status: 200, json: async () => [] });
  await assert.rejects(createLovdataHttpArchiveSource({ filename: 'gjeldende-lover.tar.bz2', fetch: unlisted }).load(), /NOT_LISTED/);
});

test('the adapter manifest pins the exact adapter version and the Lovdata host', () => {
  const registry = createLegalAdapterRegistry([lovdataAdapterRegistration({})]);
  assert.equal(LOVDATA_MANIFEST.sourceKey, 'lovdata-official');
  assert.equal(LOVDATA_MANIFEST.jurisdictionCode, 'NO');
  assert.deepEqual(LOVDATA_MANIFEST.allowedHosts, ['lovdata.no']);
  assert.ok(registry.resolve(LOVDATA_ADAPTER_KEY, LOVDATA_ADAPTER_VERSION));
  assert.equal(registry.resolve(LOVDATA_ADAPTER_KEY, '0.9.0'), null);
  assert.deepEqual(workerAdapterRegistrations.map((entry) => entry.manifest.adapterKey), [LOVDATA_ADAPTER_KEY]);
});

test('a local archive file needs its listing facts recorded', () => {
  assert.throws(() => lovdataArchiveSourceFromEnv({ LOVDATA_ARCHIVE_PATH: '/tmp/x.tar.bz2' }), /PROVENANCE_REQUIRED/);
  assert.ok(lovdataArchiveSourceFromEnv({ LOVDATA_ARCHIVE_PATH: '/tmp/x.tar.bz2', LOVDATA_ARCHIVE_SIZE_BYTES: '10', LOVDATA_ARCHIVE_LAST_MODIFIED: '2026-11-11T02:32:00Z', LOVDATA_ARCHIVE_RETRIEVED_AT: '2026-11-12T07:39:00Z' }));
});

test('discovery pages through a stable, sorted list with an "after" cursor', async () => {
  const source = archiveSource();
  const adapter = createLovdataAdapter({ archiveSource: source, pageSize: 2 });
  const first = await adapter.listChangedAuthorities(null);
  assert.deepEqual(first, { externalIds: ['NL/lov/1812-02-25', 'NL/lov/1993-06-11-101'], nextCursor: 'after:NL/lov/1993-06-11-101', complete: false });
  const second = await adapter.listChangedAuthorities(first.nextCursor);
  assert.deepEqual(second, { externalIds: ['NL/lov/2005-06-17-62'], nextCursor: null, complete: true });
  await assert.rejects(adapter.listChangedAuthorities('offset:3'), /LOVDATA_CURSOR_INVALID/);
  assert.equal(source.loads, 1, 'the archive is loaded once per adapter instance');
});

test('language variants sharing a DokumentID get distinct external identifiers', async () => {
  const nynorsk = AML.replace('<html lang="nb">', '<html lang="nn">');
  const adapter = createLovdataAdapter({ archiveSource: archiveSource([['nl/nl-20050617-062.xml', AML], ['nl/nl-20050617-062-nn.xml', nynorsk]]) });
  const { externalIds } = await adapter.listChangedAuthorities(null);
  assert.deepEqual(externalIds, ['NL/lov/2005-06-17-62', 'NL/lov/2005-06-17-62:nn']);
  assert.equal((await adapter.fetchAuthority('NL/lov/2005-06-17-62:nn')).authority.languageCode, 'nn');
});

test('an act becomes an authority with citation, provenance, validity and section passages', async () => {
  const adapter = createLovdataAdapter({ archiveSource: archiveSource() });
  const fetched = await adapter.fetchAuthority('NL/lov/2005-06-17-62');
  const { authority } = fetched;
  assert.equal(authority.citation, 'LOV-2005-06-17-62');
  assert.equal(authority.authorityType, 'act');
  assert.equal(authority.legalStatus, 'in_force');
  assert.equal(authority.validFrom, '2026-07-01');
  assert.equal(authority.publicationDate, '2005-06-17');
  assert.equal(authority.canonicalUri, 'https://lovdata.no/lov/2005-06-17-62');
  assert.equal(fetched.sourceUri, 'https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2#nl/nl-20050617-062.xml');
  assert.equal(fetched.retrievedAt, '2026-11-12T07:39:00.000Z');
  assert.equal(authority.metadata.licence, 'NLOD-2.0');
  assert.equal(authority.metadata.eli, '/eli/lov/2005/06/17/62');
  assert.match(authority.metadata.entrySha256, /^[a-f0-9]{64}$/);
  // Only references to acts present in the dataset become edges; the repealed 1977 act is absent.
  assert.deepEqual(authority.relationships.map((edge) => [edge.relationshipType, edge.targetExternalId]), [['cites', 'NL/lov/1993-06-11-101']]);

  const normalised = normaliseAuthority(authority, fetched.sourceText, LOVDATA_MANIFEST.allowedHosts);
  const passages = createSectionPassages(normalised.normalisedText, fetched.sections);
  assert.equal(passages.length, 2);
  assert.deepEqual(passages[1].sectionPath, ['Kapittel 1. Innledende bestemmelser', '§ 1-2']);
  for (const passage of passages) {
    assert.equal(normalised.normalisedText.slice(passage.startOffset, passage.endOffset), passage.content);
  }
});

test('re-reading the same archive produces identical hashes (idempotent versions)', async () => {
  const one = await createLovdataAdapter({ archiveSource: archiveSource() }).fetchAuthority('NL/lov/2005-06-17-62');
  const two = await createLovdataAdapter({ archiveSource: archiveSource() }).fetchAuthority('NL/lov/2005-06-17-62');
  const hash = (fetched) => normaliseAuthority(fetched.authority, fetched.sourceText, ['lovdata.no']).sourceContentHash;
  assert.equal(hash(one), hash(two));
});

test('unknown documents are reported as a skippable missing record', async () => {
  const adapter = createLovdataAdapter({ archiveSource: archiveSource() });
  await assert.rejects(adapter.fetchAuthority('NL/lov/2099-01-01-1'), /SOURCE_RECORD_NOT_FOUND/);
});

test('long sections are split, and every piece keeps its section path', () => {
  const long = '§ 9. Lang\n' + Array.from({ length: 60 }, (_, i) => 'Ledd ' + i + ' ' + 'x'.repeat(60)).join('\n');
  const text = 'Tittel\n\n' + long;
  const passages = createSectionPassages(text, [{ path: ['§ 9'], text: long }]);
  assert.ok(passages.length > 1);
  assert.ok(passages.every((passage) => passage.sectionPath[0] === '§ 9' && passage.content.length <= 2000));
  assert.throws(() => createSectionPassages(text, [{ path: ['§ 9'], text: 'not in text' }]), /LEGAL_SECTION_NOT_IN_SOURCE_TEXT/);
});
