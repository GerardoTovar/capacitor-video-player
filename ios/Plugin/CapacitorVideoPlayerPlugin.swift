import AVKit
import Foundation
import Capacitor
import UIKit

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(CapacitorVideoPlayer)
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
        call.resolve([
            "value": implementation.echo(value)
        ])
    }

    // MARK: - Init player(s)
    // swiftlint:disable function_body_length
    // swiftlint:disable cyclomatic_complexity
    @objc func initPlayer(_ call: CAPPluginCall) {
        self.call = call
        // DEBUG: ver si entra
        print("🔥 [initPlayer] 🔥 — llamada recibida desde JS con options:", call.options)

        guard let mode = call.options["mode"] as? String else {
            call.resolve(["result": false, "method": "initPlayer", "message": "Must provide a Mode"])
            return
        }
        guard let playerId = call.options["playerId"] as? String else {
            call.resolve(["result": false, "method": "initPlayer", "message": "Must provide a PlayerId"])
            return
        }

        self.mode = mode
        self.fsPlayerId = playerId
        print("⚙️ [initPlayer] modo:", mode, "playerId:", playerId)

        // reads opcionales…
        let mRate = (call.options["rate"] as? Float).flatMap { rateList.contains($0) ? $0 : nil } ?? 1.0
        let exitOnEnd = call.options["exitOnEnd"] as? Bool ?? true
        let loopOnEnd = (!exitOnEnd && (call.options["loopOnEnd"] as? Bool ?? false))
        let pipEnabled = call.options["pipEnabled"] as? Bool ?? true
        let backModeEnabled = call.options["bkmodeEnabled"] as? Bool ?? true
        let showControls = call.options["showControls"] as? Bool ?? true
        let displayMode = call.options["displayMode"] as? String ?? "all"
        let headers = call.options["headers"] as? [String: String]
        let title = call.options["title"] as? String
        let smallTitle = call.options["smallTitle"] as? String
        let artwork = call.options["artwork"] as? String

        self.videoRate = mRate
        self.exitOnEnd = exitOnEnd
        self.loopOnEnd = loopOnEnd
        self.pipEnabled = pipEnabled
        self.backModeEnabled = backModeEnabled
        self.showControls = showControls
        self.displayMode = displayMode
        self.headers = headers
        self.title = title
        self.smallTitle = smallTitle
        self.artwork = artwork

        if mode == "fullscreen" {
            // FULLSCREEN MODE (igual que antes)…
            guard let videoPath = call.options["url"] as? String else {
                call.resolve(["result": false, "method": "initPlayer", "message": "Must provide a video url"])
                return
            }
            // … resto de configuración de fullscreen …
            // Llamada a createVideoPlayerFullscreenView(...)
            print("🖥 [createFullscreen] creada videoPlayerFullScreenView con ID=\(playerId)")
        } else {
            // EMBEDDED MODE
            guard let urlStr = call.getString("url"),
                  let videoURL = URL(string: urlStr) else {
                call.reject("Debe indicar una URL válida")
                return
            }
            let x = CGFloat(call.getDouble("placement.x") ?? 0)
            let y = CGFloat(call.getDouble("placement.y") ?? 0)
            let width = CGFloat(call.getDouble("placement.width") ?? 200)
            let height = CGFloat(call.getDouble("placement.height") ?? 150)

            let player = AVPlayer(url: videoURL)
            let playerLayer = AVPlayerLayer(player: player)
            playerLayer.frame = CGRect(x: x, y: y, width: width, height: height)
            playerLayer.videoGravity = .resizeAspect

            DispatchQueue.main.async {
                self.bridge?.viewController?.view.layer.addSublayer(playerLayer)

                // DEBUG antes y después de guardar
                print("📥 [initPlayer] Antes: embeddedPlayers =", Array(self.embeddedPlayers.keys))
                self.embeddedPlayers[playerId] = (player, playerLayer)
                player.play()
                print("✅ [initPlayer] Después: embeddedPlayers =", Array(self.embeddedPlayers.keys))

                call.resolve([
                    "method": "initPlayer",
                    "result": true
                ])
            }
        }
    }
    // swiftlint:enable function_body_length
    // swiftlint:enable cyclomatic_complexity

    @objc func removePlayer(_ call: CAPPluginCall) {
        // DEBUG: ver si entra y con qué ID
        let pid = call.getString("playerId") ?? "nil"
        print("🔥 [removePlayer] 🔥 — llamada recibida desde JS con playerId:", pid)
        print("📤 [removePlayer] embeddedPlayers disponibles =", Array(self.embeddedPlayers.keys))

        // 1) Fullscreen
        if self.mode == "fullscreen", pid == self.fsPlayerId {
            DispatchQueue.main.async {
                self.bridge?.viewController?.dismiss(animated: true) {
                    call.resolve(["method": "removePlayer", "result": true])
                }
            }
            return
        }

        // 2) Embedded
        guard let entry = embeddedPlayers[pid] else {
            let activos = embeddedPlayers.keys.joined(separator: ", ")
            call.reject("No existe ningún player con id \(pid). Players activos: [\(activos)]")
            return
        }
        let (player, layer) = entry
        player.pause()
        DispatchQueue.main.async { layer.removeFromSuperlayer() }
        embeddedPlayers.removeValue(forKey: pid)
        call.resolve(["method": "removePlayer", "result": true])
    }

    // MARK: - Stop all player(s) playing
    // <-- método antiguo (para fullscreen only)
    @objc func stopAllPlayers(_ call: CAPPluginCall) {
        self.call = call
        if self.mode == "fullscreen" {
            if let playerView = self.videoPlayerFullScreenView {
                DispatchQueue.main.async {
                    if playerView.isPlaying { playerView.pause() }
                    call.resolve(["result": true, "method": "stopAllPlayers", "value": true])
                }
            } else {
                call.resolve(["result": false, "method": "stopAllPlayers", "message": "Fullscreen player not found"])
            }
        } else {
            // antes no hacía nada en embedded; podrías iterar embeddedPlayers aquí si lo deseas
            for (id, (pl, layer)) in embeddedPlayers {
                pl.pause()
                layer.removeFromSuperlayer()
            }
            embeddedPlayers.removeAll()
            call.resolve(["result": true, "method": "stopAllPlayers", "value": true])
        }
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