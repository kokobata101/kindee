import UIKit
import Capacitor
#if canImport(FBSDKCoreKit)
import FBSDKCoreKit
#endif

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        #if canImport(FBSDKCoreKit)
        if let id = Bundle.main.object(forInfoDictionaryKey: "FacebookAppID") as? String, !id.isEmpty {
            for ctx in URLContexts {
                ApplicationDelegate.shared.application(UIApplication.shared, open: ctx.url, sourceApplication: ctx.options.sourceApplication, annotation: ctx.options.annotation)
            }
        }
        #endif
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
