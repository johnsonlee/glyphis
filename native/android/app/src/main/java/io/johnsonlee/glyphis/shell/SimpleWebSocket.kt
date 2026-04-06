package io.johnsonlee.glyphis.shell

import android.os.Handler
import android.util.Base64
import java.io.BufferedInputStream
import java.io.OutputStream
import java.net.Socket
import java.net.URI
import java.security.SecureRandom
import javax.net.ssl.SSLSocketFactory

/**
 * Minimal WebSocket client using raw sockets (no external dependencies).
 *
 * Supports:
 * - ws:// and wss:// (TLS via SSLSocketFactory)
 * - Text frames (opcode 0x1)
 * - Close frames (opcode 0x8)
 * - Ping/pong keepalive (opcode 0x9/0xA)
 * - Client-side masking (required by RFC 6455)
 *
 * Limitations:
 * - Text messages only (binary frames are ignored)
 * - No fragmented message reassembly
 * - No extensions (e.g. permessage-deflate)
 * - Maximum single-frame payload: ~2GB (Java int limit)
 */
class SimpleWebSocket(
    private val url: String,
    private val handler: Handler,
    private val onOpen: () -> Unit,
    private val onMessage: (String) -> Unit,
    private val onClose: (Int, String) -> Unit,
    private val onError: (String) -> Unit,
) {
    private var socket: Socket? = null
    private var outputStream: OutputStream? = null
    @Volatile
    private var running = false
    private val random = SecureRandom()

    fun connect() {
        Thread {
            try {
                val uri = URI(url)
                val host = uri.host
                val useTls = uri.scheme == "wss"
                val port = if (uri.port > 0) uri.port else if (useTls) 443 else 80

                val sock = if (useTls) {
                    SSLSocketFactory.getDefault().createSocket(host, port)
                } else {
                    Socket(host, port)
                }
                socket = sock
                outputStream = sock.getOutputStream()
                val input = BufferedInputStream(sock.getInputStream())

                // WebSocket upgrade handshake
                val keyBytes = ByteArray(16)
                random.nextBytes(keyBytes)
                val key = Base64.encodeToString(keyBytes, Base64.NO_WRAP)
                val path = if (uri.rawPath.isNullOrEmpty()) "/" else uri.rawPath +
                    (if (uri.rawQuery != null) "?${uri.rawQuery}" else "")
                val hostHeader = if ((useTls && port == 443) || (!useTls && port == 80)) host
                    else "$host:$port"

                val handshake = "GET $path HTTP/1.1\r\n" +
                    "Host: $hostHeader\r\n" +
                    "Upgrade: websocket\r\n" +
                    "Connection: Upgrade\r\n" +
                    "Sec-WebSocket-Key: $key\r\n" +
                    "Sec-WebSocket-Version: 13\r\n\r\n"
                outputStream!!.write(handshake.toByteArray(Charsets.UTF_8))
                outputStream!!.flush()

                // Read HTTP response status line
                val statusLine = readLine(input)
                if (statusLine == null || !statusLine.contains("101")) {
                    onError("WebSocket handshake failed: $statusLine")
                    sock.close()
                    return@Thread
                }

                // Consume remaining response headers
                while (true) {
                    val line = readLine(input) ?: break
                    if (line.isEmpty()) break
                }

                running = true
                onOpen()

                // Frame reading loop
                while (running) {
                    val b1 = input.read()
                    if (b1 == -1) break
                    val b2 = input.read()
                    if (b2 == -1) break

                    val opcode = b1 and 0x0F
                    val masked = (b2 and 0x80) != 0
                    var payloadLen = (b2 and 0x7F).toLong()

                    if (payloadLen == 126L) {
                        val hi = input.read()
                        val lo = input.read()
                        if (hi == -1 || lo == -1) break
                        payloadLen = ((hi shl 8) or lo).toLong()
                    } else if (payloadLen == 127L) {
                        var len = 0L
                        for (i in 0..7) {
                            val b = input.read()
                            if (b == -1) break
                            len = (len shl 8) or b.toLong()
                        }
                        payloadLen = len
                    }

                    // Read mask key if present (server frames should not be masked, but handle it)
                    val maskKey = if (masked) {
                        val m = ByteArray(4)
                        readFully(input, m)
                        m
                    } else null

                    val payload = ByteArray(payloadLen.toInt())
                    readFully(input, payload)

                    // Unmask if needed
                    if (maskKey != null) {
                        for (i in payload.indices) {
                            payload[i] = (payload[i].toInt() xor maskKey[i % 4].toInt()).toByte()
                        }
                    }

                    when (opcode) {
                        0x1 -> { // text frame
                            val text = String(payload, Charsets.UTF_8)
                            onMessage(text)
                        }
                        0x8 -> { // close frame
                            val code = if (payload.size >= 2) {
                                ((payload[0].toInt() and 0xFF) shl 8) or (payload[1].toInt() and 0xFF)
                            } else 1000
                            val reason = if (payload.size > 2) {
                                String(payload, 2, payload.size - 2, Charsets.UTF_8)
                            } else ""
                            running = false
                            // Send close frame back
                            try { sendFrame(0x88, payload) } catch (_: Exception) {}
                            onClose(code, reason)
                        }
                        0x9 -> { // ping -> pong
                            try { sendFrame(0x8A, payload) } catch (_: Exception) {}
                        }
                        0xA -> { /* pong - ignore */ }
                    }
                }

                // If loop ended without close frame, report connection lost
                if (running) {
                    running = false
                    onClose(1006, "Connection lost")
                }
                try { sock.close() } catch (_: Exception) {}
            } catch (e: Exception) {
                if (running) {
                    running = false
                    onError(e.message ?: "WebSocket error")
                    onClose(1006, "Connection lost")
                } else {
                    // Already closed, just report the error
                    onError(e.message ?: "WebSocket error")
                }
            }
        }.start()
    }

    fun send(data: String) {
        if (!running) return
        Thread {
            try {
                val payload = data.toByteArray(Charsets.UTF_8)
                sendFrame(0x81, payload) // FIN + text opcode
            } catch (e: Exception) {
                onError(e.message ?: "Send failed")
            }
        }.start()
    }

    fun close(code: Int, reason: String) {
        if (!running) return
        running = false
        Thread {
            try {
                val reasonBytes = reason.toByteArray(Charsets.UTF_8)
                val payload = ByteArray(2 + reasonBytes.size)
                payload[0] = (code shr 8).toByte()
                payload[1] = (code and 0xFF).toByte()
                System.arraycopy(reasonBytes, 0, payload, 2, reasonBytes.size)
                sendFrame(0x88, payload) // FIN + close opcode
                socket?.close()
            } catch (_: Exception) {}
        }.start()
    }

    /**
     * Send a WebSocket frame. Client frames must be masked per RFC 6455.
     * @param opcodeWithFin first byte of the frame (FIN bit + opcode)
     * @param payload the unmasked payload data
     */
    private fun sendFrame(opcodeWithFin: Int, payload: ByteArray) {
        val os = outputStream ?: return

        // Determine opcode byte: set FIN bit if not already set
        val firstByte = if (opcodeWithFin and 0x80 != 0) opcodeWithFin
            else opcodeWithFin or 0x80

        val mask = ByteArray(4)
        random.nextBytes(mask)

        val header = mutableListOf<Byte>()
        header.add(firstByte.toByte())

        val len = payload.size
        when {
            len < 126 -> header.add((0x80 or len).toByte())
            len < 65536 -> {
                header.add(0xFE.toByte()) // 126 | 0x80 (masked)
                header.add((len shr 8).toByte())
                header.add((len and 0xFF).toByte())
            }
            else -> {
                header.add(0xFF.toByte()) // 127 | 0x80 (masked)
                for (i in 7 downTo 0) {
                    header.add(((len.toLong() shr (i * 8)) and 0xFF).toByte())
                }
            }
        }
        header.addAll(mask.toList())

        val masked = ByteArray(len)
        for (i in payload.indices) {
            masked[i] = (payload[i].toInt() xor mask[i % 4].toInt()).toByte()
        }

        synchronized(os) {
            os.write(header.toByteArray())
            os.write(masked)
            os.flush()
        }
    }

    private fun readLine(input: BufferedInputStream): String? {
        val sb = StringBuilder()
        while (true) {
            val b = input.read()
            if (b == -1) return if (sb.isEmpty()) null else sb.toString()
            if (b == '\n'.code) {
                // Strip trailing \r
                if (sb.isNotEmpty() && sb[sb.length - 1] == '\r') {
                    sb.setLength(sb.length - 1)
                }
                return sb.toString()
            }
            sb.append(b.toChar())
        }
    }

    private fun readFully(input: BufferedInputStream, buf: ByteArray) {
        var offset = 0
        while (offset < buf.size) {
            val n = input.read(buf, offset, buf.size - offset)
            if (n == -1) throw java.io.IOException("Unexpected end of stream")
            offset += n
        }
    }
}
