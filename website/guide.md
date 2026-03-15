# Guide

## Introduction

**pka2xml** is a tool that lets you decrypt, encrypt, and retrofit Cisco Packet Tracer simulation files (`.pka` and `.pkt`) without needing to install anything on your machine.

Packet Tracer stores its simulation files in an encrypted binary format. This tool reverses that encryption so you can:

- Inspect or edit the raw XML content of a `.pka` file.
- Re-encrypt an edited XML file back into a working `.pka`.
- "Retrofit" a `.pka` so it can be opened by **any** version of Packet Tracer.

---

## How It Works

### File Format

Packet Tracer `.pka` / `.pkt` files use a multi-layer encoding:

1. **Compression** — the raw XML is compressed with zlib.
2. **Obfuscation** — bytes are shuffled using a positional XOR scheme.
3. **Encryption** — TwoFish cipher in EAX mode with a fixed key/IV.
4. **Second obfuscation** — another round of positional XOR.

Decryption simply reverses these steps in order.

> For the detailed technical write-up, see the [original blog post](https://mircodezorzi.github.io/doc/reversing-packet-tracer/).

### Retrofit

The "Retrofit" function decrypts the file, replaces the `<VERSION>` tag with `6.0.1.0000`, and re-encrypts it. Packet Tracer uses this tag to determine version compatibility — by setting it to an old version, any modern version of Packet Tracer will open the file without complaints.

---

## Using the Web Tool

1. Go to the **[Converter Tool](/tool)** page.
2. Click the upload area or drag and drop your file.
   - `.pka` / `.pkt` files → decrypt or retrofit.
   - `.xml` files → encrypt back to `.pka`.
3. Click the appropriate button (**Decrypt**, **Encrypt**, or **Retrofit**).
4. Your browser will download the result automatically.

---

## Command-Line Usage

If you prefer to run the tool locally, you can build the CLI from source.

### Prerequisites

- `g++` (C++17 or later)
- [CryptoPP](https://www.cryptopp.com/) (`libcrypto++-dev`)
- [zlib](https://zlib.net/) (`zlib1g-dev`)
- [RE2](https://github.com/google/re2) (`libre2-dev`)

### Build

```bash
# Using Docker (easiest)
docker build -t pka2xml:1.0.0 . && docker run -it pka2xml:1.0.0

# Or build manually
make dynamic-install
```

### Usage

```bash
# Decrypt a .pka to XML
pka2xml -d input.pka output.xml

# Encrypt an XML back to .pka
pka2xml -e input.xml output.pka

# Retrofit (make readable by any PT version)
pka2xml -f input.pka output.pka

# Decrypt a Packet Tracer "nets" file
pka2xml -nets $HOME/packettracer/nets

# Decrypt a Packet Tracer log file
pka2xml -logs $HOME/packettracer/pt_12.05.2020_21.07.17.338.log
```

---

## Privacy

Files uploaded through the web tool are:

- Sent to the processing API over HTTPS.
- **Never stored** on any server.
- Returned directly to your browser for download.

---

## License

pka2xml is released under the **MIT License**. See the [LICENSE](https://github.com/DIT2D-PUO-2026/pka2xml/blob/master/LICENSE) file for details.
