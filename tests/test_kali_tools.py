import unittest

from kali_tools import install_kali_package
from package_tools import install_package


class KaliToolsTests(unittest.TestCase):
    def test_rejects_invalid_package_name(self) -> None:
        with self.assertRaises(ValueError):
            install_kali_package("https://example.invalid/tool.deb")

    def test_general_installer_rejects_url(self) -> None:
        with self.assertRaises(ValueError):
            install_package("pip", "https://example.invalid/package.whl")


if __name__ == "__main__":
    unittest.main()