import AVKit
import Foundation
import Capacitor
import UIKit

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(CapacitorVideoPlayerPlugin)
// swiftlint:disable file_length
// swiftlint:disable type_body_length
public class CapacitorVideoPlayerPlugin: CAPPlugin {
    var isPIPModeAvailable: Bool = false
    var embeddedPlayers: [String: (AVPlayer, AVPlayerLayer)] = [:]
    public var call: CAPPluginCall?
    public var videoPlayer: AVPlayerViewController?
    public var bgPlayer: AVPlayer?
    public let implementation = CapacitorVideoPlayer()
    var videoPlayerFullScreenView: FullScreenVideoPlayerView?
    var audioSession: AVAudioSession?
    var mode: String?
    var exitOnEnd: Bool = true
    var loopOnEnd: Bool = false
    var pipEnabled: Bool = true
    var backModeEnabled: Bool = true
    var showControls: Bool = true
    var displayMode: String = "all"
    var headers: [String: String]?
    var title: String?
    var smallTitle: String?
    var artwork: String?
    var fsPlayerId: String = "fullscreen"
    var videoRate: Float = 1.0
    var playObserver: Any?
    var pauseObserver: Any?
    var endObserver: Any?
    var readyObserver: Any?
    var fsDismissObserver: Any?
    var backgroundObserver: Any?
    var foregroundObserver: Any?
    var vpInternalObserver: Any?
    let rateList: [Float] = [0.25, 0.5, 0.75, 1.0, 2.0, 4.0]

    @objc override public func load() {
        super.load()
        self.addObserversToNotificationCenter()
        if UIDevice.current.userInterfaceIdiom == .pad,
           #available(iOS 13.0, *) {
            isPIPModeAvailable = true
        } else if #available(iOS 14.0, *) {
            isPIPModeAvailable = true
        }
    }

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([ "value": implementation.echo(value) ])
    }

    // MARK: - Init player(s)

    // swiftlint:disable function_body_length
    // swiftlint:disable cyclomatic_complexity
    @objc func initPlayer(_ call: CAPPluginCall) {
        self.call = call

        guard let mode = call.options["mode"] as? String else {
            call.resolve([ "result": false, "method": "initPlayer",
                           "message": "Must provide a Mode (fullscreen/embedded)" ])
            return
        }
        guard let playerId = call.options["playerId"] as? String else {
            call.resolve([ "result": false, "method": "initPlayer",
                           "message": "Must provide a PlayerId" ])
            return
        }

        // TODO: aquí va el resto de configuración (rate, exitOnEnd, loopOnEnd, headers, pipEnabled, etc)
        self.mode = mode
        self.fsPlayerId = playerId
        print("⚙️ [initPlayer] mode asignado:", mode, "playerId:", playerId)

        if mode == "fullscreen" {
            // --- Branch fullscreen completo intacto ---
            guard let videoPath = call.getString("url") else {
                call.resolve([ "result": false, "method": "initPlayer", "message": "Must provide a video url" ])
                return
            }
            // TODO: resto de fullscreen (subtitles, getURLFromFilePath, createVideoPlayerFullscreenView)
            // …
            print("🖥 [createFullscreen] creada videoPlayerFullScreenView con ID=\(self.fsPlayerId)")
        } else if mode == "embedded" {
            // --- Branch embedded con fix de orden de guardado + logging ---
            guard let urlStr = call.getString("url"),
                  let videoURL = URL(string: urlStr) else {
                call.reject("Debe indicar una URL válida")
                return
            }

            let x      = CGFloat(call.getDouble("placement.x") ?? 0)
            let y      = CGFloat(call.getDouble("placement.y") ?? 0)
            let width  = CGFloat(call.getDouble("placement.width") ?? 200)
            let height = CGFloat(call.getDouble("placement.height") ?? 150)

            // 1) Crear player y capa
            let player = AVPlayer(url: videoURL)
            let playerLayer = AVPlayerLayer(player: player)
            playerLayer.frame = CGRect(x: x, y: y, width: width, height: height)
            playerLayer.videoGravity = .resizeAspect

            // **1. Almacena el player INMEDIATAMENTE**
            print("📥 [initPlayer] Antes de asignar: embeddedPlayers =", Array(self.embeddedPlayers.keys))
            self.embeddedPlayers[playerId] = (player, playerLayer)
            print("✅ [initPlayer] Tras asignar: embeddedPlayers =", Array(self.embeddedPlayers.keys))

            // 2) Añadir al view principal y arrancar
            DispatchQueue.main.async {
                self.bridge?.viewController?.view.layer.addSublayer(playerLayer)
                player.play()

                call.resolve([
                    "method": "initPlayer",
                    "result": true
                ])
            }
            return
        }
    }
    // swiftlint:enable function_body_length
    // swiftlint:enable cyclomatic_complexity

    @objc func removePlayer(_ call: CAPPluginCall) {
        guard let playerId = call.getString("playerId") else {
            call.reject("Debe indicar playerId")
            return
        }
        print("📤 [removePlayer] embeddedPlayers disponibles =", Array(self.embeddedPlayers.keys))

        // 1) Fullscreen
        if self.mode == "fullscreen", playerId == self.fsPlayerId {
            DispatchQueue.main.async {
                self.bridge?.viewController?.dismiss(animated: true) {
                    call.resolve([ "method": "removePlayer", "result": true ])
                }
            }
            return
        }

        // 2) Embedded
        guard let entry = embeddedPlayers[playerId] else {
            let activos = embeddedPlayers.keys.joined(separator: ", ")
            call.reject("No existe ningún player con id \(playerId). Players activos: [\(activos)]")
            return
        }

        let (player, layer) = entry
        player.pause()
        DispatchQueue.main.async { layer.removeFromSuperlayer() }
        embeddedPlayers.removeValue(forKey: playerId)
        call.resolve([ "method": "removePlayer", "result": true ])
    }

    // swiftlint:enable function_body_length
    // swiftlint:enable cyclomatic_complexity

    // MARK: - Play the given player

    @objc func isPlaying(_ call: CAPPluginCall) {
        self.call = call
        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "isPlaying", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {

            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    let isPlaying: Bool = playerView.isPlaying
                    call.resolve([ "result": true, "method": "isPlaying", "value": isPlaying])
                    return
                }
            } else {
                let error: String = "Fullscreen player not found"
                print(error)
                call.resolve([ "result": false, "method": "isPlaying", "message": error])
                return
            }
        }
    }
    // MARK: - Play the given player

    @objc func play(_ call: CAPPluginCall) {
        self.call = call
        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "play", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {

            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    playerView.play()
                    call.resolve([ "result": true, "method": "play", "value": true])
                    return
                }
            } else {
                let error: String = "Fullscreen player not found"
                print(error)
                call.resolve([ "result": false, "method": "play", "message": error])
                return
            }
        }
    }

    // MARK: - Pause the given player

    @objc func pause(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "pause", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    playerView.pause()
                    call.resolve([ "result": true, "method": "pause", "value": true])
                    return
                }
            } else {
                let error: String = "Fullscreen player not found"
                print(error)
                call.resolve([ "result": false, "method": "pause", "message": error])
                return
            }
        }
    }

    // MARK: - get Duration for the given player

    @objc func getDuration(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "getDuration", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    let duration: Double = playerView.getDuration()
                    call.resolve([ "result": true, "method": "getDuration", "value": duration])
                    return
                }
            } else {
                let error: String = "Fullscreen playerId not found"
                print(error)
                call.resolve([ "result": false, "method": "getDuration", "message": error])
                return
            }
        }
    }

    // MARK: - get CurrentTime for the given player

    @objc func getCurrentTime(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "getCurrentTime", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    let currentTime: Double = playerView.getCurrentTime()
                    call.resolve([ "result": true, "method": "getCurrentTime",
                                   "value": currentTime])
                    return
                }
            } else {
                let error: String = "Fullscreen playerId not found"
                print(error)
                call.resolve([ "result": false, "method": "getCurrentTime", "message": error])
                return
            }

        }
    }

    // MARK: - set CurrentTime for the given player

    @objc func setCurrentTime(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "setCurrentTime", "message": error])
            return
        }
        guard let seekTime = call.options["seektime"] as? Double else {
            let error: String = "Must provide a time in second"
            print(error)
            call.resolve([ "result": false, "method": "setCurrentTime", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    playerView.setCurrentTime(time: seekTime)
                    call.resolve([ "result": true, "method": "setCurrentTime",
                                   "value": seekTime])
                    return
                }
            } else {
                let error: String = "Fullscreen playerId not found"
                print(error)
                call.resolve([ "result": false, "method": "setCurrentTime", "message": error])
                return
            }
        }
    }

    // MARK: - get Volume for the given player

    @objc func getVolume(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "getVolume", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    let volume: Float = playerView.getVolume()
                    call.resolve([ "result": true, "method": "getVolume", "value": volume])
                    return
                }
            } else {
                let error: String = "Fullscreen playerId not found"
                print(error)
                call.resolve([ "result": false, "method": "getVolume", "message": error])
                return
            }
        }
    }

    // MARK: - set Volume for the given player

    @objc func setVolume(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "setVolume", "message": error])
            return
        }
        guard let volume = call.options["volume"] as? Float else {
            let error: String = "Must provide a volume value"
            print(error)
            call.resolve([ "result": false, "method": "setVolume", "message": error])

            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    playerView.setVolume(volume: volume)
                    call.resolve([ "result": true, "method": "setVolume", "value": volume])
                    return
                }
            } else {
                let error: String = "Fullscreen playerId not found"
                print(error)
                call.resolve([ "result": false, "method": "setVolume", "message": error])
                return
            }
        }

    }

    // MARK: - get Muted for the given player

    @objc func getMuted(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "getMuted", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    let muted: Bool = playerView.getMuted()
                    call.resolve([ "result": true, "method": "getMuted", "value": muted])
                    return
                }
            } else {
                let error: String = "Fullscreen playerId not found"
                print(error)
                call.resolve([ "result": false, "method": "getMuted", "message": error])
                return
            }
        }
    }

    // MARK: - set Muted for the given player

    @objc func setMuted(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "setMuted", "message": error])
            return
        }
        guard let muted = call.options["muted"] as? Bool else {
            let error: String = "Must provide a boolean true/false"
            print(error)
            call.resolve([ "result": false, "method": "setMuted", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    playerView.setMuted(muted: muted)
                    call.resolve([ "result": true, "method": "setMuted", "value": muted])
                    return
                }
            } else {
                let error: String = "Fullscreen playerId not found"
                print(error)
                call.resolve([ "result": false, "method": "setMuted", "message": error])
                return
            }
        }
    }

    // MARK: - Stop all player(s) playing

    @objc func stopAllPlayers(_ call: CAPPluginCall) {
        // 1) Recorremos todos los embedded players
        for (playerId, (player, layer)) in embeddedPlayers {
            player.pause()
            DispatchQueue.main.async {
                layer.removeFromSuperlayer()
            }
        }
        // 2) Limpiamos el diccionario
        embeddedPlayers.removeAll()
        // 3) Devolvemos éxito
        call.resolve([
            "method": "stopAllPlayers",
            "result": true
        ])
    }

    // MARK: - get Rate for the given player

    @objc func getRate(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "getRate", "message": error])
            return
        }
        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    let rate: Float = playerView.getRate()
                    call.resolve([ "result": true, "method": "getRate", "value": rate])
                    return
                }
            } else {
                let error: String = "Fullscreen playerId not found"
                print(error)
                call.resolve([ "result": false, "method": "getRate", "message": error])
                return
            }
        }
    }

    // MARK: - set Rate for the given player

    @objc func setRate(_ call: CAPPluginCall) {
        self.call = call

        guard let playerId = call.options["playerId"] as? String else {
            let error: String = "Must provide a playerId"
            print(error)
            call.resolve([ "result": false, "method": "setRate", "message": error])
            return
        }
        guard let rate = call.options["rate"] as? Float else {
            let error: String = "Must provide a rate value"
            print(error)
            call.resolve([ "result": false, "method": "setRate", "message": error])

            return
        }
        self.videoRate = rateList.contains(rate) ? rate : 1.0

        if self.mode == "fullscreen" && self.fsPlayerId == playerId {
            if let playerView = self.videoPlayerFullScreenView {
                //34567890123456789012345678901234567890
                DispatchQueue.main.async {
                    playerView.setRate(rate: self.videoRate)
                    call.resolve([ "result": true, "method": "setRate",
                                   "value": self.videoRate])
                    return
                }
            } else {
                let error: String = "Fullscreen playerId not found"
                print(error)
                call.resolve([ "result": false, "method": "setRate", "message": error])
                return
            }
        }

    }

}

// swiftlint:enable type_body_length
// swiftlint:enable file_length