/**
 * Read the public name tag from an address's own explorer page, which is the only admissible address evidence
 * (HANDOFF rule 1). Prints the tag verbatim and the date to put in the `checked` column.
 *
 *   node scripts/registry/read-tag.mjs <etherscan.io|basescan.org|arbiscan.io|snowscan.xyz|polygonscan.com|optimistic.etherscan.io> <0xaddress>...
 *
 * Arbiscan address pages return 403 to bots, so for arbiscan.io the /txs?a= page header is read instead (the tag
 * is still shown there). Requests are paced and the script stops on any non-200 or challenge page; it never works
 * around one. "no name tag" means the page has none: do not add the address. Tags that look like deposit plumbing
 * (deposit, funder, forwarder, internal, deployer) are flagged, but HANDOFF rule 3 decides admissibility. When the
 * page says the label was copied from a public researcher compilation, that is printed too: record it in the row's
 * note, as existing rows do. The page logic is in tag-reader.mjs, shared with the Landmarks scan.
 */
import {readTag, BlockedError, PAUSE_MS} from './tag-reader.mjs';

const [host, ...addrs] = process.argv.slice(2);
if (!host || !addrs.length) {
  console.error('usage: node scripts/registry/read-tag.mjs <etherscan.io|basescan.org|arbiscan.io|snowscan.xyz|polygonscan.com|optimistic.etherscan.io> <0xaddress>...');
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
for (const a of addrs) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) {
    console.log(a, '| not an address');
    continue;
  }
  try {
    const {tag, compilation, reports} = await readTag(host, a);
    const plumbing = tag && /deposit|funder|forwarder|internal|deployer/i.test(tag) ? '   [looks like plumbing: check rule 3]' : '';
    const disclosed = compilation ? `   [explorer discloses: tagged based on ${compilation}]` : '';
    console.log(`${a.toLowerCase()} | ${tag ? `TAG: ${tag}${plumbing}${disclosed}${reports.map((r) => `   [explorer alert: ${r}]`).join('')}   (checked ${today})` : 'no name tag'}`);
  } catch (e) {
    if (e instanceof BlockedError) {
      console.error(`stopped: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
  await sleep(PAUSE_MS);
}
